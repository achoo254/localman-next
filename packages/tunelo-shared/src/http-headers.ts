/** Hop-by-hop headers (RFC 2616 §13.5.1) that must not be forwarded/relayed. */
const HOP_BY_HOP = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailers",
	"transfer-encoding",
	"upgrade",
]);

/**
 * Drop hop-by-hop headers. Applied to requests before proxying to the local
 * service, and to responses before re-streaming — otherwise a relayed
 * `transfer-encoding: chunked` collides with the relay's own framing.
 */
export function stripHopByHopHeaders(
	headers: Record<string, string | string[]>,
): Record<string, string | string[]> {
	const out: Record<string, string | string[]> = {};
	for (const [key, value] of Object.entries(headers)) {
		if (!HOP_BY_HOP.has(key.toLowerCase())) out[key] = value;
	}
	return out;
}

/**
 * True when a response must be relayed without buffering — Server-Sent Events,
 * or any body with no `content-length` (chunked / unknown-length stream). The
 * tunnel server sets `X-Accel-Buffering: no` on these so a fronting nginx
 * streams them straight through and skips caching, while length-bounded static
 * responses stay bufferable and cacheable.
 */
export function needsUnbufferedRelay(
	headers: Record<string, string | string[]>,
): boolean {
	let contentType = "";
	let hasContentLength = false;
	for (const [key, value] of Object.entries(headers)) {
		const lower = key.toLowerCase();
		if (lower === "content-type") {
			contentType = Array.isArray(value) ? value.join(" ") : value;
		}
		if (lower === "content-length") hasContentLength = true;
	}
	return contentType.includes("text/event-stream") || !hasContentLength;
}

/** Headers of a local forward (`LOCAL_FORWARD`), lower case. */
export const LOCAL_FORWARD_HEADERS = {
	/** Link token of the machine's owner (app → server only). */
	ACCESS: "tunelo-access",
	/** Port on the machine's loopback (app → server → machine). */
	LOCAL_PORT: "tunelo-local-port",
	/** Set by the server once the link token passed (server → machine only). */
	GRANTED: "tunelo-forward-granted",
	/** Code of a refused forward on the response (`LOCAL_FORWARD_ERRORS`). */
	ERROR: "tunelo-forward-error",
} as const;

const TUNELO_HEADER_PREFIX = "tunelo-";

/** Whether a header name is reserved for Tunelo (`tunelo-*`). */
export function isTuneloHeader(name: string): boolean {
	return name.toLowerCase().startsWith(TUNELO_HEADER_PREFIX);
}

/** Drops every `tunelo-*` header: only the relay may set them. */
export function stripTuneloHeaders(
	headers: Record<string, string | string[]>,
): Record<string, string | string[]> {
	const out: Record<string, string | string[]> = {};
	for (const [key, value] of Object.entries(headers)) {
		if (!isTuneloHeader(key)) out[key] = value;
	}
	return out;
}
