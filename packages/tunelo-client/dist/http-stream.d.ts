import type { StreamDataMessage, StreamEndMessage, StreamErrorMessage, StreamStartMessage, TunnelRequest } from "./shared/protocol.js";
type StreamFrame = StreamStartMessage | StreamDataMessage | StreamEndMessage | StreamErrorMessage;
/** Transport the stream writes to — decoupled from ws so a WS relay can reuse it. */
export interface StreamTransport {
    send(frame: StreamFrame): void;
    /** Bytes queued but not yet flushed — drives backpressure. */
    bufferedAmount(): number;
}
/** Summary of a completed stream — feeds the request inspector (body capped). */
export interface ProxyStreamResult {
    status: number;
    headers: Record<string, string | string[]>;
    bodyPreview: string | null;
    truncated: boolean;
}
export interface ActiveStream {
    /** Abort the local request (the downstream consumer went away). */
    cancel(): void;
    /** Resolves once the local response finishes, errors, or is cancelled. */
    done: Promise<ProxyStreamResult>;
}
/**
 * Relay one request to the local service and stream the response back as
 * stream-start → stream-data* → stream-end. Chunks are coalesced by size,
 * the local read is paused when the transport queue is full, and exactly one
 * terminal path (end / error / cancel) ever runs.
 */
export declare function proxyRequestStream(request: TunnelRequest, localPort: number, transport: StreamTransport, localHost?: string): ActiveStream;
export {};
