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
    /** How long the server holds a browser upgrade for `ws-open-result`:
     *  the client's own handshake cap plus room for the control channel. */
    WS_APP_OPEN_RESULT_TIMEOUT_MS: 15_000,
    /** Max body (bytes) of an app's refusal relayed back to the browser */
    WS_APP_REJECT_BODY_MAX: 4096,
};
/** Names a client may list in `AuthMessage.capabilities`. */
export const CLIENT_CAPABILITIES = {
    /** Client answers every `ws-open` with a `ws-open-result`. */
    WS_OPEN_RESULT: "ws-open-result",
};
/** What a tunnel is for (`AuthMessage.kind`). */
export const TUNNEL_KINDS = {
    /** `tunelo http`: the user's own tunnels, within the account quota. */
    HTTP: "http",
    /** A background agent's machine tunnel, with a quota of its own. */
    MACHINE: "machine",
};
/** `code` of a refused `auth` or `register-tunnel` about the tunnel itself.
 *  A client should report these instead of retrying the same request. */
export const TUNNEL_REFUSAL_CODES = {
    /** The subdomain is open on another connection. */
    SUBDOMAIN_IN_USE: "TUNELO_TUNNEL_001",
    /** The subdomain is held for another account or machine. */
    SUBDOMAIN_HELD: "TUNELO_TUNNEL_004",
    /** The account has as many tunnels of this kind open as it may. */
    QUOTA_EXCEEDED: "TUNELO_TUNNEL_005",
};
export const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
/** Public URL of an HTTP tunnel. The domain is deployment config (the
 *  server's primary entry of `TUNNEL_DOMAINS`), never a constant. */
export function buildTunnelUrl(subdomain, domain) {
    return `https://${subdomain}.${domain}`;
}
/** Scopes of the Tunelo resource on the identity provider. */
export const TUNNEL_SCOPES = {
    /** Open tunnels on the account (CLI). */
    OPEN: "tunnels:open",
    /** List the account's tunnels (Localman, link tokens). */
    READ: "tunnels:read",
};
/** Prefix of the server-minted tokens (anonymous device and link tokens);
 *  anything else is an identity-provider JWT. */
export const SERVER_TOKEN_PREFIX = "tunelo_";
export function generateRequestId() {
    // Unguessable: a client must not be able to answer another's request.
    return `req_${globalThis.crypto.randomUUID()}`;
}
/** Names a server may list in `AuthResult.features`. */
export const SERVER_FEATURES = {
    /** The server gates `LOCAL_FORWARD.PATH` on this machine tunnel and
     *  strips client-sent `tunelo-*` headers, so the machine may serve it. */
    LOCAL_FORWARD: "local-forward",
};
/**
 * Requests an app linked to the machine's owner (Localman) sends to
 * `localhost:<port>` on the machine, through its machine tunnel:
 * `https://m-<hash>.<domain>/.tunelo/forward/<path>`.
 */
export const LOCAL_FORWARD = {
    PATH: "/.tunelo/forward",
    /** Scope of the server-minted link tokens that may forward. */
    SCOPE: "tunnels:forward",
    /**
     * Ports never forwarded, by the server and by the machine (which adds
     * its own ports and the debug/IDE ports of running processes): admin,
     * debug and automation endpoints that run whatever a request asks, and
     * plain-text stores a request body can talk to across protocols.
     */
    DENY_PORTS: [
        2375, // Docker
        2376, // Docker (TLS)
        2379, // etcd client
        2380, // etcd peer
        4444, // Selenium
        5005, // JVM debugger
        5984, // CouchDB
        6379, // Redis
        8200, // Vault
        8500, // Consul
        9200, // Elasticsearch
        9222, // Chrome DevTools
        9229, // Node inspector
        9300, // Elasticsearch transport
        9515, // chromedriver
        10250, // kubelet
        10255, // kubelet read-only
        11211, // memcached
        11434, // Ollama
        15672, // RabbitMQ management
        63342, // JetBrains IDEs
    ],
};
/** `tunelo-forward-error` codes of a refused forward. */
export const LOCAL_FORWARD_ERRORS = {
    /** No valid link token of this machine's owner (always 404). */
    NOT_FOUND: "TUNELO_FORWARD_001",
    /** The port is on a deny list (403). */
    PORT_BLOCKED: "TUNELO_FORWARD_002",
    /** Forwarding is turned off on the machine (403). */
    DISABLED: "TUNELO_FORWARD_003",
    /** `tunelo-local-port` is not a port (400). */
    BAD_PORT: "TUNELO_FORWARD_004",
    /** Nothing answers on the port (502). */
    PORT_CLOSED: "TUNELO_FORWARD_005",
    /** The machine tunnel is not connected (502). */
    MACHINE_OFFLINE: "TUNELO_TUNNEL_002",
    /** Too many forwards to the machine, or failed ones from the caller (429). */
    RATE_LIMITED: "TUNELO_FORWARD_006",
};
/** Whether `path` (path and query) is under `LOCAL_FORWARD.PATH`. */
export function isLocalForwardPath(path) {
    const base = LOCAL_FORWARD.PATH;
    if (!path.toLowerCase().startsWith(base.toLowerCase()))
        return false;
    const next = path.charAt(base.length);
    return next === "" || next === "/" || next === "?";
}
/** A `tunelo-local-port` value as a port number, or null. */
export function parseLocalPort(value) {
    if (typeof value !== "string" || !/^\d{1,5}$/.test(value))
        return null;
    const port = Number(value);
    return port >= 1 && port <= 65_535 ? port : null;
}
/** Whether a port is on the shared deny list. */
export function isDeniedForwardPort(port) {
    return LOCAL_FORWARD.DENY_PORTS.includes(port);
}
