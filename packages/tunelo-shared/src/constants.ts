/** Shared constants for tunnel protocol */

export const DEFAULTS = {
	SERVER_PORT: 3001,
	WS_PATH: "/tunnel",
	HEALTH_PATH: "/health",
	MAX_BODY_SIZE: 50 * 1024 * 1024,
	REQUEST_TIMEOUT_MS: 30_000,
	/** Idle timeout (ms) for a relayed response stream — reset on every frame so SSE/long downloads stay open */
	STREAM_IDLE_TIMEOUT_MS: 60_000,
	PING_INTERVAL_MS: 30_000,
	/** Cap on the WS handshake, TCP connect included. Without one, a blackholed
	 *  SYN stalls the attempt for the kernel's whole retry budget (~135s
	 *  measured), and the reconnect backoff sits idle for all of it. */
	CONNECT_TIMEOUT_MS: 10_000,
	RECONNECT_BASE_MS: 1_000,
	RECONNECT_MAX_MS: 30_000,
	MAX_SUBDOMAIN_LENGTH: 63,
	/** Max WebSocket messages per second per connection */
	WS_RATE_LIMIT: 1000,
	/** Grace period (ms) to wait for client reconnect before rejecting pending requests */
	RECONNECT_GRACE_MS: 5_000,
	/** TCP tunnel port range start */
	TCP_PORT_MIN: 10_000,
	/** TCP tunnel port range end */
	TCP_PORT_MAX: 10_999,
	/** Max TCP tunnels per server */
	TCP_MAX_TUNNELS: 100,
	/** Max concurrent TCP connections per tunnel */
	TCP_MAX_CONNECTIONS_PER_TUNNEL: 50,
	/** TCP idle connection timeout (ms) — 10 minutes */
	TCP_IDLE_TIMEOUT_MS: 10 * 60 * 1000,
	/** Max new TCP connections per second per tunnel */
	TCP_CONNECT_RATE_LIMIT: 10,
	/** Max concurrent browser WebSocket connections per tunnel */
	WS_APP_MAX_PER_TUNNEL: 50,
	/** Local WS handshake timeout (ms) for the browser→app relay */
	WS_APP_HANDSHAKE_TIMEOUT_MS: 10_000,
	/** Max frames buffered before the local WS finishes opening */
	WS_APP_PREOPEN_QUEUE_MAX: 64,
} as const;

export const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Public URL of an HTTP tunnel. The domain is deployment config (the
 *  server's primary entry of `TUNNEL_DOMAINS`), never a constant. */
export function buildTunnelUrl(subdomain: string, domain: string): string {
	return `https://${subdomain}.${domain}`;
}

/** Scopes of the Tunelo resource on the identity provider. */
export const TUNNEL_SCOPES = {
	/** Open tunnels on the account (CLI). */
	OPEN: "tunnels:open",
	/** List the account's tunnels (Localman, link tokens). */
	READ: "tunnels:read",
} as const;

export type TunnelScope = (typeof TUNNEL_SCOPES)[keyof typeof TUNNEL_SCOPES];

/** Prefix of the server-minted tokens (anonymous device and link tokens);
 *  anything else is an identity-provider JWT. */
export const SERVER_TOKEN_PREFIX = "tunelo_";

export function generateRequestId(): string {
	return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
