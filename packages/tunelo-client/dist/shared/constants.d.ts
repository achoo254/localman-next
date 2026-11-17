/** Shared constants for tunnel protocol */
export declare const DEFAULTS: {
    readonly SERVER_PORT: 3001;
    readonly WS_PATH: "/tunnel";
    readonly HEALTH_PATH: "/health";
    readonly MAX_BODY_SIZE: number;
    readonly REQUEST_TIMEOUT_MS: 30000;
    /** Idle timeout (ms) for a relayed response stream — reset on every frame so SSE/long downloads stay open */
    readonly STREAM_IDLE_TIMEOUT_MS: 60000;
    readonly PING_INTERVAL_MS: 30000;
    /** Cap on the WS handshake, TCP connect included. Without one, a blackholed
     *  SYN stalls the attempt for the kernel's whole retry budget (~135s
     *  measured), and the reconnect backoff sits idle for all of it. */
    readonly CONNECT_TIMEOUT_MS: 10000;
    readonly RECONNECT_BASE_MS: 1000;
    readonly RECONNECT_MAX_MS: 30000;
    readonly MAX_SUBDOMAIN_LENGTH: 63;
    /** Max WebSocket messages per second per connection */
    readonly WS_RATE_LIMIT: 1000;
    /** Grace period (ms) to wait for client reconnect before rejecting pending requests */
    readonly RECONNECT_GRACE_MS: 5000;
    /** TCP tunnel port range start */
    readonly TCP_PORT_MIN: 10000;
    /** TCP tunnel port range end */
    readonly TCP_PORT_MAX: 10999;
    /** Max TCP tunnels per server */
    readonly TCP_MAX_TUNNELS: 100;
    /** Max concurrent TCP connections per tunnel */
    readonly TCP_MAX_CONNECTIONS_PER_TUNNEL: 50;
    /** TCP idle connection timeout (ms) — 10 minutes */
    readonly TCP_IDLE_TIMEOUT_MS: number;
    /** Max new TCP connections per second per tunnel */
    readonly TCP_CONNECT_RATE_LIMIT: 10;
    /** Max concurrent browser WebSocket connections per tunnel */
    readonly WS_APP_MAX_PER_TUNNEL: 50;
    /** Local WS handshake timeout (ms) for the browser→app relay */
    readonly WS_APP_HANDSHAKE_TIMEOUT_MS: 10000;
    /** Max frames buffered before the local WS finishes opening */
    readonly WS_APP_PREOPEN_QUEUE_MAX: 64;
    /** How long the server holds a browser upgrade for `ws-open-result`:
     *  the client's own handshake cap plus room for the control channel. */
    readonly WS_APP_OPEN_RESULT_TIMEOUT_MS: 15000;
    /** Max body (bytes) of an app's refusal relayed back to the browser */
    readonly WS_APP_REJECT_BODY_MAX: 4096;
};
/** Names a client may list in `AuthMessage.capabilities`. */
export declare const CLIENT_CAPABILITIES: {
    /** Client answers every `ws-open` with a `ws-open-result`. */
    readonly WS_OPEN_RESULT: "ws-open-result";
};
/** What a tunnel is for (`AuthMessage.kind`). */
export declare const TUNNEL_KINDS: {
    /** `tunelo http`: the user's own tunnels, within the account quota. */
    readonly HTTP: "http";
    /** A background agent's machine tunnel, with a quota of its own. */
    readonly MACHINE: "machine";
};
export type TunnelKind = (typeof TUNNEL_KINDS)[keyof typeof TUNNEL_KINDS];
/** `code` of a refused `auth` or `register-tunnel` about the tunnel itself.
 *  A client should report these instead of retrying the same request. */
export declare const TUNNEL_REFUSAL_CODES: {
    /** The subdomain is open on another connection. */
    readonly SUBDOMAIN_IN_USE: "TUNELO_TUNNEL_001";
    /** The subdomain is held for another account or machine. */
    readonly SUBDOMAIN_HELD: "TUNELO_TUNNEL_004";
    /** The account has as many tunnels of this kind open as it may. */
    readonly QUOTA_EXCEEDED: "TUNELO_TUNNEL_005";
};
export declare const SUBDOMAIN_REGEX: RegExp;
/** Public URL of an HTTP tunnel. The domain is deployment config (the
 *  server's primary entry of `TUNNEL_DOMAINS`), never a constant. */
export declare function buildTunnelUrl(subdomain: string, domain: string): string;
/** Scopes of the Tunelo resource on the identity provider. */
export declare const TUNNEL_SCOPES: {
    /** Open tunnels on the account (CLI). */
    readonly OPEN: "tunnels:open";
    /** List the account's tunnels (Localman, link tokens). */
    readonly READ: "tunnels:read";
};
export type TunnelScope = (typeof TUNNEL_SCOPES)[keyof typeof TUNNEL_SCOPES];
/** Prefix of the server-minted tokens (anonymous device and link tokens);
 *  anything else is an identity-provider JWT. */
export declare const SERVER_TOKEN_PREFIX = "tunelo_";
export declare function generateRequestId(): string;
