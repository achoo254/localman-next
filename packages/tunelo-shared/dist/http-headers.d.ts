/**
 * Drop hop-by-hop headers. Applied to requests before proxying to the local
 * service, and to responses before re-streaming — otherwise a relayed
 * `transfer-encoding: chunked` collides with the relay's own framing.
 */
export declare function stripHopByHopHeaders(headers: Record<string, string | string[]>): Record<string, string | string[]>;
/**
 * True when a response must be relayed without buffering — Server-Sent Events,
 * or any body with no `content-length` (chunked / unknown-length stream). The
 * tunnel server sets `X-Accel-Buffering: no` on these so a fronting nginx
 * streams them straight through and skips caching, while length-bounded static
 * responses stay bufferable and cacheable.
 */
export declare function needsUnbufferedRelay(headers: Record<string, string | string[]>): boolean;
