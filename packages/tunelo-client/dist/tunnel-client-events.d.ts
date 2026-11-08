import type { AuthResult, RegisterTunnelResult, TcpConnectionClose, TcpConnectionOpen, TcpDataMessage, TcpRegisterResult } from "./shared/protocol.js";
/** One relayed HTTP request, after its response finished. */
export interface TunnelRequestLog {
    method: string;
    path: string;
    status: number;
    durationMs: number;
    subdomain?: string | undefined;
}
/** A relayed request with headers and body previews (request inspector). */
export interface TunnelInspectorEntry extends TunnelRequestLog {
    id: string;
    /** Epoch ms when the request arrived. */
    timestamp: number;
    requestHeaders: Record<string, string | string[]>;
    requestBody: string | null;
    responseHeaders: Record<string, string | string[]>;
    responseBody: string | null;
    entryType: "normal";
}
/**
 * Payload of each event `TunnelClient` emits (`client.on(name, listener)`
 * receives the listed argument). Listen to `error`: Node throws an "error"
 * event nobody hears.
 */
export interface TunnelClientEvents {
    /** The server granted the tunnel; `url` is its public address. */
    connected: AuthResult;
    /** The control channel closed; a reconnect follows unless stopped. */
    disconnected: undefined;
    reconnecting: {
        attempt: number;
        delay: number;
    };
    /** Socket errors, and the error that ended reconnecting (`fatal`). */
    error: Error;
    /** ISO date after which this anonymous token stops working. */
    "legacy-token": string;
    "tunnel-registered": RegisterTunnelResult;
    "tunnel-register-error": RegisterTunnelResult;
    "tcp-registered": TcpRegisterResult;
    "tcp-register-error": TcpRegisterResult;
    "tcp-connection-open": TcpConnectionOpen;
    "tcp-data": TcpDataMessage;
    "tcp-connection-close": TcpConnectionClose;
    request: TunnelRequestLog;
    "inspector-entry": TunnelInspectorEntry;
}
