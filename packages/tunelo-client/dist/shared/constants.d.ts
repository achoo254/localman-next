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
/** Names a server may list in `AuthResult.features`. */
export declare const SERVER_FEATURES: {
    /** The server gates `LOCAL_FORWARD.PATH` on this machine tunnel and
     *  strips client-sent `tunelo-*` headers, so the machine may serve it. */
    readonly LOCAL_FORWARD: "local-forward";
};
/**
 * Requests an app linked to the machine's owner (Localman) sends to
 * `localhost:<port>` on the machine, through its machine tunnel:
 * `https://m-<hash>.<domain>/.tunelo/forward/<path>`.
 */
export declare const LOCAL_FORWARD: {
    readonly PATH: "/.tunelo/forward";
    /** Scope of the server-minted link tokens that may forward. */
    readonly SCOPE: "tunnels:forward";
    /**
     * Ports never forwarded, by the server and by the machine (which adds
     * its own ports and the debug/IDE ports of running processes): admin,
     * debug and automation endpoints that run whatever a request asks, and
     * plain-text stores a request body can talk to across protocols.
     */
    readonly DENY_PORTS: readonly [2375, 2376, 2379, 2380, 4444, 5005, 5984, 6379, 8200, 8500, 9200, 9222, 9229, 9300, 9515, 10250, 10255, 11211, 11434, 15672, 63342];
};
/** `tunelo-forward-error` codes of a refused forward. */
export declare const LOCAL_FORWARD_ERRORS: {
    /** No valid link token of this machine's owner (always 404). */
    readonly NOT_FOUND: "TUNELO_FORWARD_001";
    /** The port is on a deny list (403). */
    readonly PORT_BLOCKED: "TUNELO_FORWARD_002";
    /** Forwarding is turned off on the machine (403). */
    readonly DISABLED: "TUNELO_FORWARD_003";
    /** `tunelo-local-port` is not a port (400). */
    readonly BAD_PORT: "TUNELO_FORWARD_004";
    /** Nothing answers on the port (502). */
    readonly PORT_CLOSED: "TUNELO_FORWARD_005";
    /** The machine tunnel is not connected (502). */
    readonly MACHINE_OFFLINE: "TUNELO_TUNNEL_002";
    /** Too many forwards to the machine, or failed ones from the caller (429). */
    readonly RATE_LIMITED: "TUNELO_FORWARD_006";
};
/** Whether `path` (path and query) is under `LOCAL_FORWARD.PATH`. */
export declare function isLocalForwardPath(path: string): boolean;
/** A `tunelo-local-port` value as a port number, or null. */
export declare function parseLocalPort(value: unknown): number | null;
/** Whether a port is on the shared deny list. */
export declare function isDeniedForwardPort(port: number): boolean;
