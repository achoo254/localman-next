import type http from "node:http";
import { stripHopByHopHeaders } from "@tunelo/shared";
import { createLogger } from "../logger.js";
import type { StreamSink } from "../stream/stream-registry.js";
import { CACHE_CONFIG } from "./cache-config.js";
import {
	classifyResponse,
	isLookupEligible,
	normalizeAcceptEncoding,
} from "./cacheability.js";
import { type CachedResponse, getCached, setCached } from "./response-cache.js";

const logger = createLogger("tunelo-cache-serve");

/**
 * Serve a cacheable GET straight from Redis, bypassing the WS relay entirely.
 * Returns bytes written on a hit, or null when nothing was served. A failed
 * write (e.g. a poisoned entry with an invalid header) is swallowed and treated
 * as a miss so the request falls through to the relay — the cache must never be
 * able to crash the relay.
 */
export async function tryServeFromCache(
	res: http.ServerResponse,
	subdomain: string,
	path: string,
	method: string,
	hasAuth: boolean,
	acceptEncoding: string,
): Promise<number | null> {
	if (!isLookupEligible(method, path, hasAuth)) return null;
	const variant = normalizeAcceptEncoding(acceptEncoding);
	const hit = await getCached(subdomain, path, variant);
	if (!hit || res.writableEnded || res.destroyed) return null;
	try {
		const body = Buffer.from(hit.body, "base64");
		res.writeHead(hit.status, {
			...hit.headers,
			"x-tunelo-cache": "HIT",
		} as http.OutgoingHttpHeaders);
		res.end(body);
		return body.length;
	} catch (err) {
		logger.warn(
			{ err: (err as Error).message, subdomain },
			"Cache serve failed — falling through to relay",
		);
		return null;
	}
}

/**
 * Wrap a response sink so a cacheable static response is tee'd into Redis while
 * still streaming to the browser. Non-GET / auth'd requests pass through
 * untouched. The `X-Tunelo-Cache` header exposes MISS/BYPASS for verification.
 * Cached under the request's normalized `Accept-Encoding` so a compressed body
 * is never served to a client that did not ask for that encoding.
 */
export function wrapForCache(
	inner: StreamSink,
	subdomain: string,
	path: string,
	method: string,
	hasAuth: boolean,
	acceptEncoding: string,
): StreamSink {
	if (method !== "GET" || hasAuth) return inner;

	const variant = normalizeAcceptEncoding(acceptEncoding);
	let cacheable = false;
	let ttl = 0;
	let status = 0;
	let headers: Record<string, string | string[]> = {};
	const chunks: Buffer[] = [];
	let size = 0;

	return {
		onStart(s, h) {
			status = s;
			const decision = classifyResponse(path, s, h, CACHE_CONFIG);
			cacheable = decision.cacheable;
			ttl = decision.ttl;
			if (cacheable) headers = stripHopByHopHeaders(h);
			h["x-tunelo-cache"] = cacheable ? "MISS" : "BYPASS";
			inner.onStart(s, h);
		},
		onData(chunk) {
			inner.onData(chunk);
			if (!cacheable) return;
			size += chunk.length;
			if (size > CACHE_CONFIG.maxObjectBytes) {
				cacheable = false;
				chunks.length = 0;
				return;
			}
			chunks.push(chunk);
		},
		onEnd() {
			inner.onEnd();
			if (!cacheable || chunks.length === 0) return;
			const entry: CachedResponse = {
				status,
				headers,
				body: Buffer.concat(chunks).toString("base64"),
			};
			void setCached(subdomain, path, variant, entry, ttl);
		},
		onError(err) {
			inner.onError(err);
		},
	};
}
