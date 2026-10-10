import { OperationError } from "@localman/operations";
import { MAX_JSON_BODY_KB } from "@localman/shared";
import type { Request, Response } from "express";
import {
	type ProxyConcurrency,
	createProxyConcurrency,
} from "../api-client/proxy-concurrency.js";
import { fromRawHeaders } from "../api-client/proxy-headers.js";
import type { SsrfGuard } from "../api-client/ssrf-guard.js";
import { closeSignal } from "./mock-behavior-rest.js";
import {
	rawBodyOf,
	rememberRawBody,
	setLogSource,
} from "./request-log-capture.js";
import type { MockAddress, MockProject } from "./resolve-project.js";
import { sendUpstreamError } from "./upstream-errors.js";
import {
	OutboundError,
	defaultOutboundGuard,
	forwardHttpRequest,
} from "./upstream-forwarder.js";
import {
	SOURCE_HEADER,
	UPSTREAM_HOP_HEADER,
	upstreamRequestHeaders,
} from "./upstream-headers.js";
import { relayResponseHeaders } from "./upstream-response-headers.js";
import {
	type TunnelLookup,
	isBelowBase,
	ownerTunnelUrl,
	staysBelowStart,
	upstreamUrlOf,
} from "./upstream-target.js";
import { tuneloFailureOf } from "./upstream-tunelo.js";

/** Request body forwarded at most: the mock runtime's JSON limit. */
export const MAX_FORWARD_REQUEST_BYTES = MAX_JSON_BODY_KB * 1024;
/**
 * Upstream exchanges in flight per owner (all their projects together)
 * and in the process: a slow upstream holds its owner's slots, never the
 * whole runtime's, however many projects that owner has.
 */
export const UPSTREAM_CONCURRENCY = { perUser: 8, total: 64 } as const;

/**
 * Deadline of one upstream exchange: under nginx's 30 s
 * `proxy_read_timeout`, so the client gets the runtime's JSON 502
 * (`timeout`) rather than nginx's HTML 504.
 */
export const UPSTREAM_TIMEOUT_MS = 25_000;

/** What forwarding needs; tests swap the guard and the tunnel lookup. */
export interface UpstreamDeps {
	readonly guard: SsrfGuard;
	/** Keyed by project owner. */
	readonly concurrency: ProxyConcurrency;
	readonly timeoutMs: number;
	readonly findTunnel: TunnelLookup;
}

export function createUpstreamDeps(
	overrides: Partial<UpstreamDeps> = {},
): UpstreamDeps {
	return {
		guard: overrides.guard ?? defaultOutboundGuard(),
		concurrency:
			overrides.concurrency ?? createProxyConcurrency(UPSTREAM_CONCURRENCY),
		timeoutMs: overrides.timeoutMs ?? UPSTREAM_TIMEOUT_MS,
		findTunnel: overrides.findTunnel ?? ownerTunnelUrl,
	};
}

/**
 * The client's body: the bytes the JSON parser read, else the unread
 * stream up to `MAX_FORWARD_REQUEST_BYTES` (`"too_large"` past it; the
 * rest is drained so the response can still be sent).
 */
export function readForwardBody(
	req: Request,
): Promise<Buffer | null | "too_large"> {
	const known = rawBodyOf(req);
	if (known) return Promise.resolve(known);
	if (req.readableEnded) return Promise.resolve(null);
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let size = 0;
		req.on("data", (chunk: Buffer) => {
			size += chunk.length;
			if (size <= MAX_FORWARD_REQUEST_BYTES) chunks.push(chunk);
		});
		req.once("end", () => {
			if (size > MAX_FORWARD_REQUEST_BYTES) return resolve("too_large");
			const body = Buffer.concat(chunks);
			if (body.length > 0) rememberRawBody(req, body);
			resolve(body.length > 0 ? body : null);
		});
		req.once("error", reject);
	});
}

function sendRuntimeError(
	res: Response,
	status: number,
	code: string,
	message: string,
): void {
	res.status(status).json(new OperationError(status, code, message).toBody());
}

/**
 * Sends a request no resource or enabled endpoint answers to the
 * project's upstream and relays the answer with `X-Localman-Source:
 * upstream` (allowed headers only, see `relayResponseHeaders`). Failures
 * answer 502 `UPSTREAM_UNAVAILABLE` (with `hint: "tunelo http <port>"`
 * for a tunnel, also when Tunelo itself says the app is unreachable),
 * 503 `UPSTREAM_BUSY`, 508 `UPSTREAM_LOOP`, 502
 * `UPSTREAM_RESPONSE_TOO_LARGE`, or 400 `UPSTREAM_PATH_INVALID` for a
 * path that climbs out of the upstream's base path. `charge` takes the
 * bytes of the relayed body (the secret's response budget).
 */
export async function serveFromUpstream(
	req: Request,
	res: Response,
	project: MockProject,
	address: MockAddress,
	deps: UpstreamDeps,
	charge: (bytes: number) => void,
): Promise<void> {
	const { upstream, owner } = project;
	if (upstream.kind === "none") throw new Error("Project has no upstream");
	setLogSource(res, "upstream");
	res.setHeader(SOURCE_HEADER, "upstream");
	if (req.headers[UPSTREAM_HOP_HEADER.toLowerCase()] !== undefined) {
		return sendUpstreamError(res, owner, upstream, "loop");
	}
	if (!staysBelowStart(address.rawPath)) return sendPathInvalid(res);
	const query = req.originalUrl.split("?").slice(1).join("?");
	const url = await upstreamUrlOf(
		upstream,
		owner,
		address.rawPath,
		query,
		deps.findTunnel,
	);
	if (url === null) return sendUpstreamError(res, owner, upstream, "no_tunnel");
	if (upstream.kind === "url" && !isBelowBase(url, upstream.baseUrl)) {
		return sendPathInvalid(res);
	}
	const slot = deps.concurrency.acquire(owner);
	if (!slot.ok) return sendUpstreamError(res, owner, upstream, "busy");
	try {
		const body = await readForwardBody(req);
		if (body === "too_large") {
			const text = "Request body is too large";
			return sendRuntimeError(res, 413, "PAYLOAD_TOO_LARGE", text);
		}
		const response = await forwardHttpRequest(
			{
				url,
				method: req.method,
				headers: upstreamRequestHeaders(fromRawHeaders(req.rawHeaders)),
				body,
				signal: closeSignal(res),
				timeoutMs: deps.timeoutMs,
				clientIp: req.ip ?? null,
			},
			deps.guard,
		);
		if (response.truncated) {
			return sendUpstreamError(res, owner, upstream, "too_large");
		}
		const tunelo =
			upstream.kind === "tunnel" ? tuneloFailureOf(response) : null;
		if (tunelo !== null) return sendUpstreamError(res, owner, upstream, tunelo);
		charge(response.body.length);
		relayResponseHeaders(res, response.headers, url);
		res.status(response.status);
		res.end(req.method === "HEAD" ? undefined : response.body);
	} catch (error) {
		if (!(error instanceof OutboundError)) throw error;
		await sendUpstreamError(res, owner, upstream, error.reason);
	} finally {
		slot.release();
	}
}

function sendPathInvalid(res: Response): void {
	const text = "The path leaves the upstream's base path";
	sendRuntimeError(res, 400, "UPSTREAM_PATH_INVALID", text);
}
