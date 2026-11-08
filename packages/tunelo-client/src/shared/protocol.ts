// Copy of packages/tunelo-shared/src/protocol.ts: edit the original, then run `pnpm --filter @tunelo/client sync:shared`.
/** WS message types for tunnel protocol — discriminated union on "type" field */

import type { TunnelKind } from "./constants.js";

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
	/** Local port of the first tunnel, listed back to the account owner. */
	localPort?: number;
	/** Stable id of this machine (from the CLI config). */
	deviceId?: string;
	/** Human name of this machine (hostname). */
	deviceName?: string;
	/** Authenticate only, open no HTTP tunnel (`tunelo tcp`). Servers that do
	 *  not know the flag open one as before. */
	tcpOnly?: boolean;
	/** Optional protocol features this client speaks (`CLIENT_CAPABILITIES`).
	 *  Servers ignore names they do not know, and older servers ignore the
	 *  field altogether. */
	capabilities?: string[];
	/** `machine`: a background agent's tunnel. The server assigns it a
	 *  subdomain held for the account and machine (`deviceId` required),
	 *  counts it against a quota of its own, and lets a new connection of the
	 *  same machine replace a stale one. Default `http`. */
	kind?: TunnelKind;
}

export interface AuthResult {
	type: "auth-result";
	success: boolean;
	subdomain: string;
	url: string;
	error?: string;
	/** `TUNELO_*` code of a refusal, e.g. `TUNELO_AUTH_004` or one of
	 *  `TUNNEL_REFUSAL_CODES`. */
	code?: string;
	/** ISO date after which this anonymous token stops opening tunnels. */
	legacyTokenCutoff?: string;
	/** Optional server features granted to this tunnel (`SERVER_FEATURES`).
	 *  Absent from servers that predate the field. */
	features?: string[];
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
	/** `TUNELO_*` code of a refusal (`TUNNEL_REFUSAL_CODES`). */
	code?: string;
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
/**
 * Browser WebSocket relay — outcome of opening the local WS (client → server),
 * sent once per `ws-open` by clients declaring
 * `CLIENT_CAPABILITIES.WS_OPEN_RESULT`. A server that saw the capability holds
 * the browser's upgrade until this arrives, so the browser gets the app's own
 * answer (403, 401, 404…) instead of `101` followed by a close.
 */
export type WsOpenResultMessage =
	| {
			type: "ws-open-result";
			id: string;
			ok: true;
			/** Subprotocol the local app selected, if any. */
			protocol?: string;
	  }
	| {
			type: "ws-open-result";
			id: string;
			ok: false;
			/** HTTP status of the app's refusal; 502 when it could not be
			 *  reached, 504 when its handshake timed out. */
			status: number;
			statusText?: string;
			headers?: Record<string, string | string[]>;
			/** base64 body, at most `WS_APP_REJECT_BODY_MAX` bytes decoded. */
			body?: string;
	  };
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
	| WsOpenResultMessage
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
