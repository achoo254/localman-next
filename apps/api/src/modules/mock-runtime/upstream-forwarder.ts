import type { OperationError } from "@localman/operations";
import { type HeaderEntry, parseHttpUrl } from "@localman/shared/api-client";
import { toProxyError } from "../api-client/proxy-errors.js";
import { sendChecked } from "../api-client/proxy-forwarder.js";
import { fromRawHeaders } from "../api-client/proxy-headers.js";
import { readResponseBody } from "../api-client/proxy-response-body.js";
import { createRuntimeSsrfGuard } from "../api-client/runtime-ssrf-guard.js";
import type { SsrfGuard } from "../api-client/ssrf-guard.js";

/** Tunelo relays for 30 s; waiting longer only holds a slot. */
export const DEFAULT_FORWARD_TIMEOUT_MS = 30_000;
/** Response bytes kept (after decompression): what a mock response may hold. */
export const MAX_FORWARD_RESPONSE_BYTES = 2 * 1024 * 1024;

/** One request the server sends for a project (upstream, inbox, callback). */
export interface OutboundRequest {
	/** Absolute http(s) URL; its host is pinned through the SSRF guard. */
	readonly url: string;
	readonly method: string;
	/**
	 * Sent in order with repeats, minus hop-by-hop headers, `Host` (always
	 * the URL's) and `Content-Length` (always the real body length).
	 * `X-Localman-Proxy: 1` is always added.
	 */
	readonly headers: readonly HeaderEntry[];
	readonly body: Buffer | null;
	/** Aborts the exchange (the caller went away). */
	readonly signal?: AbortSignal;
	/** One deadline for DNS, connect and the whole response; default 30 s. */
	readonly timeoutMs?: number;
	readonly maxResponseBytes?: number;
	/** Original caller, appended to `X-Forwarded-For` and `Forwarded`. */
	readonly clientIp?: string | null;
}

export interface OutboundResponse {
	readonly status: number;
	readonly statusText: string;
	/** As received; the body below is already decompressed. */
	readonly headers: HeaderEntry[];
	readonly body: Buffer;
	/** More than `maxResponseBytes` were available; `body` is cut there. */
	readonly truncated: boolean;
	readonly ms: number;
}

/** Why no response came back. */
export type OutboundFailure = "blocked" | "dns" | "timeout" | "connect";

/** The target never answered, or must not be reached. */
export class OutboundError extends Error {
	constructor(
		readonly reason: OutboundFailure,
		/** Node error code of a failed connection (`ECONNREFUSED`…), if known. */
		readonly cause: string | null,
	) {
		super(`Outbound request failed: ${reason}`);
		this.name = "OutboundError";
	}
}

const FAILURE_OF: Readonly<Record<string, OutboundFailure>> = {
	PROXY_TARGET_BLOCKED: "blocked",
	PROXY_DNS_FAILED: "dns",
	PROXY_TIMEOUT: "timeout",
};

function outboundErrorOf(error: OperationError): OutboundError {
	const reason = FAILURE_OF[error.code] ?? "connect";
	const details: unknown = error.details;
	const cause =
		typeof details === "object" &&
		details !== null &&
		"cause" in details &&
		typeof details.cause === "string"
			? details.cause
			: null;
	return new OutboundError(reason, cause);
}

let runtimeGuard: SsrfGuard | undefined;

/** The guard of the running server, built on first use. */
export function defaultOutboundGuard(): SsrfGuard {
	runtimeGuard ??= createRuntimeSsrfGuard();
	return runtimeGuard;
}

const withoutHost = (headers: readonly HeaderEntry[]): HeaderEntry[] =>
	headers.filter((h) => h.name.trim().toLowerCase() !== "host");

/**
 * Sends one request from the server with the API client proxy's
 * machinery: the SSRF guard pins every address (private, loopback and
 * the server's own addresses refused; mock and Tunelo tunnel hosts on
 * their default port allowed), the socket connects to the pinned
 * address, `X-Localman-Proxy: 1` marks it. Redirects are not followed:
 * a 3xx is the answer. Throws `OutboundError` when no response came.
 */
export async function forwardHttpRequest(
	request: OutboundRequest,
	guard: SsrfGuard = defaultOutboundGuard(),
): Promise<OutboundResponse> {
	const url = parseHttpUrl(request.url);
	if (!url) throw new OutboundError("blocked", null);
	const timeoutMs = request.timeoutMs ?? DEFAULT_FORWARD_TIMEOUT_MS;
	const deadline = AbortSignal.timeout(timeoutMs);
	const signal = request.signal
		? AbortSignal.any([deadline, request.signal])
		: deadline;
	const started = performance.now();
	try {
		const { response } = await sendChecked(
			{
				method: request.method,
				url,
				headers: withoutHost(request.headers),
				body: request.body,
			},
			{ guard, clientIp: null, forwardedProto: "https" },
			request.clientIp ?? null,
			signal,
		);
		const read = await readResponseBody(
			response,
			request.maxResponseBytes ?? MAX_FORWARD_RESPONSE_BYTES,
		);
		const status = response.statusCode ?? 0;
		return {
			status,
			statusText: response.statusMessage ?? "",
			headers: fromRawHeaders(response.rawHeaders),
			body: read.bytes,
			truncated: read.truncated,
			ms: Math.round(performance.now() - started),
		};
	} catch (error) {
		throw outboundErrorOf(toProxyError(error, deadline, timeoutMs));
	}
}
