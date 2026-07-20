/** WS message types for tunnel protocol — discriminated union on "type" field */

export interface TunnelRequest {
	type: "request";
	id: string;
	method: string;
	path: string;
	headers: Record<string, string | string[]>;
	body: string | null;
	/** Subdomain this request is targeting — filled by server from Host header */
	subdomain?: string;
}

export interface TunnelResponse {
	type: "response";
	id: string;
	status: number;
	headers: Record<string, string | string[]>;
	body: string | null;
}

/**
 * Generic streaming frames, keyed by `id`, for relaying a body incrementally
 * (SSE, chunked responses, large downloads) instead of buffering it whole.
 *
 * Deliberately direction-agnostic and not named "response" so a future
 * bidirectional relay can reuse the same start → data* → end/error lifecycle
 * keyed by a stream id.
 */
export interface StreamStartMessage {
	type: "stream-start";
	id: string;
	/** HTTP status for response streams (unused/0 for non-HTTP reuse). */
	status: number;
	headers: Record<string, string | string[]>;
}

export interface StreamDataMessage {
	type: "stream-data";
	id: string;
	/** base64-encoded chunk. */
	data: string;
}

export interface StreamEndMessage {
	type: "stream-end";
	id: string;
}

export interface StreamErrorMessage {
	type: "stream-error";
	id: string;
	message: string;
}

export interface AuthMessage {
	type: "auth";
	key: string;
	subdomain: string;
	/** Basic auth credentials in "user:pass" format — sent during tunnel registration */
	auth?: string;
}

export interface AuthResult {
	type: "auth-result";
	success: boolean;
	subdomain: string;
	url: string;
	error?: string;
}

export interface ErrorMessage {
	type: "error";
	code: ErrorCode;
	message: string;
	requestId?: string;
}

export interface PingMessage {
	type: "ping";
	timestamp: number;
}

export interface PongMessage {
	type: "pong";
	timestamp: number;
}

/** Register additional tunnel on existing WS connection (after initial auth) */
export interface RegisterTunnelMessage {
	type: "register-tunnel";
	subdomain?: string;
	localPort: number;
	auth?: string;
}

/** Server response to register-tunnel */
export interface RegisterTunnelResult {
	type: "register-tunnel-result";
	success: boolean;
	subdomain: string;
	localPort: number;
	url: string;
	error?: string;
}

/** TCP tunnel — register a TCP port mapping */
export interface TcpRegisterMessage {
	type: "tcp-register";
	localPort: number;
	remotePort?: number;
}

/** TCP tunnel — server response to tcp-register */
export interface TcpRegisterResult {
	type: "tcp-register-result";
	success: boolean;
	localPort: number;
	remotePort: number;
	url: string;
	error?: string;
}

/** TCP tunnel — bidirectional binary data relay (base64 encoded) */
export interface TcpDataMessage {
	type: "tcp-data";
	connectionId: string;
	data: string;
}

/** TCP tunnel — new TCP connection opened on server */
export interface TcpConnectionOpen {
	type: "tcp-connection-open";
	connectionId: string;
	remotePort: number;
	sourceIp: string;
}

/** TCP tunnel — connection closed (bidirectional) */
export interface TcpConnectionClose {
	type: "tcp-connection-close";
	connectionId: string;
}

/** Browser WebSocket relay — ask the client to open a local WS (server → client) */
export interface WsOpenMessage {
	type: "ws-open";
	id: string;
	/** Tunnel subdomain the browser connected to. */
	subdomain: string;
	/** Request path/query of the upgrade (e.g. "/socket.io?token=x"). */
	path: string;
	headers: Record<string, string | string[]>;
	/** Requested Sec-WebSocket-Protocol subprotocol(s), if any. */
	protocol?: string;
}
/** Browser WebSocket relay — frame payload (bidirectional). */
export interface WsDataMessage {
	type: "ws-data";
	id: string;
	/** base64-encoded frame payload. */
	data: string;
	/** true = binary frame, false = UTF-8 text frame. */
	binary: boolean;
}
/** Browser WebSocket relay — connection closed (bidirectional). */
export interface WsCloseMessage {
	type: "ws-close";
	id: string;
	code?: number;
	reason?: string;
}

/** Streaming lifecycle frames for one relayed body (start → data* → end/error). */
export type StreamMessage =
	| StreamStartMessage
	| StreamDataMessage
	| StreamEndMessage
	| StreamErrorMessage;

export type ServerToClientMessage =
	| TunnelRequest
	| StreamMessage
	| AuthResult
	| RegisterTunnelResult
	| TcpRegisterResult
	| TcpConnectionOpen
	| TcpDataMessage
	| TcpConnectionClose
	| WsOpenMessage
	| WsDataMessage
	| WsCloseMessage
	| ErrorMessage
	| PingMessage;
export type ClientToServerMessage =
	| TunnelResponse
	| StreamMessage
	| AuthMessage
	| RegisterTunnelMessage
	| TcpRegisterMessage
	| TcpDataMessage
	| TcpConnectionClose
	| WsDataMessage
	| WsCloseMessage
	| ErrorMessage
	| PongMessage;
export type TunnelMessage = ServerToClientMessage | ClientToServerMessage;

/** Parse raw WS text message into typed protocol message */
export function parseMessage(data: string): TunnelMessage {
	return JSON.parse(data) as TunnelMessage;
}

/** WS close codes for clean disconnect reasons */
export const WS_CLOSE_CODES = {
	NORMAL: 1000,
	GOING_AWAY: 1001,
	AUTH_FAILED: 4001,
	AUTH_TIMEOUT: 4002,
	RATE_LIMITED: 4003,
	SUBDOMAIN_TAKEN: 4004,
} as const;

export enum ErrorCode {
	AUTH_FAILED = "AUTH_FAILED",
	SUBDOMAIN_TAKEN = "SUBDOMAIN_TAKEN",
	SUBDOMAIN_INVALID = "SUBDOMAIN_INVALID",
	REQUEST_TIMEOUT = "REQUEST_TIMEOUT",
	TUNNEL_NOT_FOUND = "TUNNEL_NOT_FOUND",
	BODY_TOO_LARGE = "BODY_TOO_LARGE",
	UNAUTHORIZED = "UNAUTHORIZED",
	INTERNAL_ERROR = "INTERNAL_ERROR",
	INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
	TOTP_REQUIRED = "TOTP_REQUIRED",
	TOTP_INVALID = "TOTP_INVALID",
	MAX_KEYS_REACHED = "MAX_KEYS_REACHED",
	KEY_NOT_FOUND = "KEY_NOT_FOUND",
	EMAIL_TAKEN = "EMAIL_TAKEN",
	ADMIN_FORBIDDEN = "ADMIN_FORBIDDEN",
	MAX_TUNNELS_EXCEEDED = "MAX_TUNNELS_EXCEEDED",
}
