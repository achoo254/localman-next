import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import type { HeaderEntry } from "@localman/shared/api-client";
import { toRawHeaders } from "./proxy-headers.js";
import type { PinnedTarget } from "./ssrf-guard.js";

export interface HopRequest {
	readonly method: string;
	readonly url: URL;
	/** Final header lines, `Host` and `Content-Length` included. */
	readonly headers: readonly HeaderEntry[];
	readonly body: Buffer | null;
	readonly target: PinnedTarget;
	readonly signal: AbortSignal;
	/** `performance.now()` when this hop started (before DNS). */
	readonly startedAt: number;
}

/** Phases of one hop in ms; `null` when the phase did not happen. */
export interface HopTimings {
	readonly dns: number | null;
	readonly connect: number | null;
	readonly tls: number | null;
	readonly ttfb: number;
}

export interface HopResponse {
	readonly response: IncomingMessage;
	readonly timings: HopTimings;
}

/** Response header bytes accepted from a target (Node's default is 16 KB). */
const MAX_RESPONSE_HEADER_BYTES = 64 * 1024;

/**
 * `lookup` that answers the address the SSRF guard checked, whatever name
 * is asked: the socket connects there and nowhere else, so a DNS answer
 * that changes between the check and the connect (rebinding) is ignored.
 */
function pinnedLookup(target: PinnedTarget): LookupFunction {
	return (_hostname, options, callback) => {
		const { address, family } = target;
		if (options.all) callback(null, [{ address, family }]);
		else callback(null, address, family);
	};
}

/**
 * Sends one request on a fresh connection (no keep-alive pool, so every
 * hop connects to its own pinned address) and resolves at the response
 * headers. Headers go out exactly as given: a raw header array keeps
 * order, case and repeats, and Node adds no `Host` of its own.
 */
export function sendHop(hop: HopRequest): Promise<HopResponse> {
	const { url, target, startedAt } = hop;
	const secure = url.protocol === "https:";
	const transport = secure ? https : http;
	const sniName = isIP(target.hostname) === 0 ? target.hostname : undefined;
	return new Promise((resolve, reject) => {
		let connectedAt: number | null = null;
		let secureAt: number | null = null;
		const connectStart = startedAt + (target.dnsMs ?? 0);
		const request = transport.request({
			method: hop.method,
			host: target.hostname,
			port: target.port,
			path: `${url.pathname}${url.search}`,
			headers: toRawHeaders(hop.headers),
			agent: false,
			lookup: pinnedLookup(target),
			servername: sniName,
			signal: hop.signal,
			maxHeaderSize: MAX_RESPONSE_HEADER_BYTES,
		});
		request.once("socket", (socket) => {
			socket.once("connect", () => {
				connectedAt = performance.now();
			});
			socket.once("secureConnect", () => {
				secureAt = performance.now();
			});
		});
		request.once("response", (response) => {
			const now = performance.now();
			resolve({
				response,
				timings: {
					dns: target.dnsMs,
					connect: connectedAt === null ? null : connectedAt - connectStart,
					tls:
						secure && secureAt !== null && connectedAt !== null
							? secureAt - connectedAt
							: null,
					ttfb: now - startedAt,
				},
			});
		});
		// Kept after the response too: a reset mid-body must not crash the
		// process (the body reader sees it as an aborted response).
		request.on("error", reject);
		request.end(hop.body ?? undefined);
	});
}
