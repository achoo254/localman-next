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
