/**
 * Response as the API client shows it, the same whether the request went
 * straight from the browser or through the proxy (the proxy returns exactly
 * this shape, see `proxy-envelope.ts`).
 */
import type { HeaderEntry } from "./request-model.js";

/** `utf8` for text bodies, `base64` when the bytes are not valid UTF-8. */
export const BODY_ENCODINGS = ["utf8", "base64"] as const;
export type BodyEncoding = (typeof BODY_ENCODINGS)[number];

/**
 * Phases in milliseconds. A phase is `null` when it did not happen (a reused
 * connection has no dns/connect/tls, plain http has no tls) or could not be
 * measured (a direct cross-origin fetch without `Timing-Allow-Origin`).
 */
export interface ResponseTimings {
	dns: number | null;
	connect: number | null;
	tls: number | null;
	/** Time to the first byte of the response, from the start of the send. */
	ttfb: number | null;
	total: number;
}

export interface ClientResponse {
	status: number;
	statusText: string;
	/** In arrival order, repeated names kept (several `Set-Cookie`). */
	headers: HeaderEntry[];
	body: string;
	bodyEncoding: BodyEncoding;
	/** Bytes of the body after decompression, as returned in `body`. */
	size: number;
	timings: ResponseTimings;
	/** URL of the last hop after redirects. */
	finalUrl: string;
	/** The body was cut at `MAX_RESPONSE_BODY_BYTES`. */
	truncated: boolean;
}
