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
/** Headers of a local forward (`LOCAL_FORWARD`), lower case. */
export declare const LOCAL_FORWARD_HEADERS: {
    /** Link token of the machine's owner (app → server only). */
    readonly ACCESS: "tunelo-access";
    /** Port on the machine's loopback (app → server → machine). */
    readonly LOCAL_PORT: "tunelo-local-port";
    /** Set by the server once the link token passed (server → machine only). */
    readonly GRANTED: "tunelo-forward-granted";
    /** Code of a refused forward on the response (`LOCAL_FORWARD_ERRORS`). */
    readonly ERROR: "tunelo-forward-error";
};
/** Whether a header name is reserved for Tunelo (`tunelo-*`). */
export declare function isTuneloHeader(name: string): boolean;
/** Drops every `tunelo-*` header: only the relay may set them. */
export declare function stripTuneloHeaders(headers: Record<string, string | string[]>): Record<string, string | string[]>;
