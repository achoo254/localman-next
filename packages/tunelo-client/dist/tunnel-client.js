import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { proxyRequestStream } from "./http-stream.js";
import { CLIENT_CAPABILITIES, DEFAULTS, } from "./shared/constants.js";
import { parseMessage, } from "./shared/protocol.js";
import { TunnelAuthError, stopsReconnecting } from "./tunnel-auth-error.js";
import { WsAppProxy } from "./ws-app-proxy.js";
export class TunnelClient extends EventEmitter {
    socket = null;
    stopped = false;
    attempts = 0;
    /** Guards against more than one retry loop running at a time. */
    reconnecting = false;
    options;
    /** Maps subdomain → local port for multi-tunnel routing */
    subdomainPortMap = new Map();
    /** In-flight response streams keyed by request id (for cancel/cleanup). */
    activeStreams = new Map();
    /** Browser→app WebSocket relay: opens a local WS per `ws-open` and bridges frames. */
    wsAppProxy;
    constructor(options) {
        super();
        this.options = options;
        this.wsAppProxy = new WsAppProxy((msg) => this.socket?.send(JSON.stringify(msg)), (subdomain) => this.subdomainPortMap.get(subdomain) ?? this.options.localPort, { localHost: options.localHost });
    }
    /** Resolves the token first, so each (re)connect uses a fresh one. */
    async connect() {
        const key = await this.options.getApiKey();
        if (!key)
            throw new Error("No access token");
        return this.open(key);
    }
    open(key) {
        return new Promise((resolve, reject) => {
            const wsUrl = this.buildWsUrl();
            // Bind every handler to this exact socket. Reading `this.socket`
            // inside them lets a superseded socket's late events act on the
            // live one — an "open" arriving after a newer socket was assigned
            // used to send the auth frame into a still-CONNECTING socket and
            // throw out of the event loop, killing the CLI mid-reconnect.
            // Cap the handshake. A path that blackholes packets — the same one that
            // strands the keepalive — swallows our SYN too, and an uncapped attempt
            // then waits out the kernel's retry budget: measured at 135s against a
            // DROP rule, during which the backoff loop is stuck on that one attempt
            // and cannot retry. The path came back 42s before the client noticed.
            const socket = new WebSocket(wsUrl, {
                handshakeTimeout: this.options.connectTimeoutMs ?? DEFAULTS.CONNECT_TIMEOUT_MS,
            });
            this.socket = socket;
            let authResolved = false;
            /** Set only when the server actually granted a tunnel. */
            let authAccepted = false;
            /** Cleared on close so a dead socket's probes cannot outlive it. */
            let keepalive = null;
            /** Flipped back by every pong; a probe finding it false kills the socket. */
            let alive = true;
            socket.on("pong", () => {
                alive = true;
            });
            socket.on("open", () => {
                const authMsg = {
                    type: "auth",
                    key,
                    subdomain: this.options.subdomain ?? "",
                    auth: this.options.auth,
                    localPort: this.options.localPort,
                    deviceId: this.options.deviceId,
                    deviceName: this.options.deviceName,
                    ...(this.options.tcpOnly ? { tcpOnly: true } : {}),
                    ...(this.options.kind ? { kind: this.options.kind } : {}),
                    capabilities: [CLIENT_CAPABILITIES.WS_OPEN_RESULT],
                };
                socket.send(JSON.stringify(authMsg));
                // The server probes us and drops the tunnel when we stop answering,
                // but nothing told us it had. A path that dies without a FIN — a NAT
                // or firewall dropping the flow, which is how every tunnel behind one
                // eventually goes — leaves this socket ESTABLISHED forever: no
                // "close" event, so no reconnect, while the server has long since
                // unregistered the subdomain and answers callers 502. Probe back so
                // we notice on our own instead of waiting for an event that is never
                // coming. `terminate` (not `close`) is what a dead peer needs: a
                // close handshake waits for a reply that will not arrive.
                keepalive = setInterval(() => {
                    if (socket.readyState !== WebSocket.OPEN)
                        return;
                    if (!alive) {
                        socket.terminate();
                        return;
                    }
                    alive = false;
                    socket.ping();
                }, this.options.pingIntervalMs ?? DEFAULTS.PING_INTERVAL_MS);
                keepalive.unref?.();
            });
            socket.on("message", (data) => {
                let msg;
                try {
                    msg = parseMessage(data.toString());
                }
                catch {
                    return;
                }
                switch (msg.type) {
                    case "auth-result":
                        this.handleAuthResult(msg, authResolved, socket, resolve, reject);
                        if (!authResolved)
                            authResolved = true;
                        if (msg.success)
                            authAccepted = true;
                        break;
                    case "register-tunnel-result":
                        this.handleRegisterTunnelResult(msg);
                        break;
                    case "tcp-register-result":
                        this.handleTcpRegisterResult(msg);
                        break;
                    case "request":
                        this.handleRequest(msg);
                        break;
                    case "stream-error":
                        // Server signals the downstream consumer is gone — stop producing.
                        this.activeStreams.get(msg.id)?.cancel();
                        this.activeStreams.delete(msg.id);
                        break;
                    case "tcp-connection-open":
                        this.emit("tcp-connection-open", msg);
                        break;
                    case "tcp-data":
                        this.emit("tcp-data", msg);
                        break;
                    case "tcp-connection-close":
                        this.emit("tcp-connection-close", msg);
                        break;
                    case "ws-open":
                        this.wsAppProxy.open(msg);
                        break;
                    case "ws-data":
                        this.wsAppProxy.data(msg);
                        break;
                    case "ws-close":
                        this.wsAppProxy.close(msg);
                        break;
                    default:
                        break;
                }
            });
            socket.on("close", () => {
                // Belongs to this socket, so it is cleared even when a superseded
                // socket closes — otherwise its probes keep firing forever.
                if (keepalive) {
                    clearInterval(keepalive);
                    keepalive = null;
                }
                // A superseded socket's teardown must not touch live state.
                if (this.socket !== socket)
                    return;
                // Abort in-flight local requests — their responses can't be delivered.
                for (const stream of this.activeStreams.values())
                    stream.cancel();
                this.activeStreams.clear();
                this.wsAppProxy.closeAll();
                this.emit("disconnected");
                // Only chase a connection that was actually granted. A rejected auth
                // closes this socket too, but the caller's retry loop already owns
                // that case — reconnecting here as well forks a second loop, and each
                // fork restarts the backoff at 1s, so the delay never grows.
                if (!this.stopped && authAccepted) {
                    this.reconnect();
                }
            });
            socket.on("error", (err) => {
                if (!authResolved) {
                    authResolved = true;
                    reject(err);
                }
                this.emit("error", err);
            });
        });
    }
    disconnect() {
        this.stopped = true;
        this.socket?.close();
    }
    /** False once disconnected or given up (e.g. the sign-in expired). */
    isActive() {
        return !this.stopped;
    }
    /** Register a TCP tunnel after auth */
    registerTcp(localPort, remotePort) {
        const msg = {
            type: "tcp-register",
            localPort,
            remotePort,
        };
        this.sendMsg(msg);
    }
    /** Get raw socket for TcpProxy to attach handlers */
    getSocket() {
        return this.socket;
    }
    /** Send a JSON message over the WebSocket */
    sendMsg(msg) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(msg));
        }
    }
    buildWsUrl() {
        // Convert http(s) to ws(s) and append WS_PATH
        const url = this.options.serverUrl
            .replace(/^https:\/\//, "wss://")
            .replace(/^http:\/\//, "ws://");
        return `${url}${DEFAULTS.WS_PATH}`;
    }
    handleAuthResult(result, alreadyResolved, socket, resolve, reject) {
        if (alreadyResolved)
            return;
        if (!result.success) {
            socket.close();
            reject(new TunnelAuthError(result.error ?? "Auth failed", result.code));
            return;
        }
        this.attempts = 0;
        if (result.legacyTokenCutoff !== undefined) {
            this.emit("legacy-token", result.legacyTokenCutoff);
        }
        this.subdomainPortMap.set(result.subdomain, this.options.localPort);
        this.emit("connected", result);
        this.registerAdditionalTunnels();
        resolve(result);
    }
    handleRegisterTunnelResult(result) {
        if (result.success) {
            this.subdomainPortMap.set(result.subdomain, result.localPort);
            this.emit("tunnel-registered", result);
        }
        else {
            this.emit("tunnel-register-error", result);
        }
    }
    handleTcpRegisterResult(result) {
        if (result.success) {
            this.emit("tcp-registered", result);
        }
        else {
            this.emit("tcp-register-error", result);
        }
    }
    registerAdditionalTunnels() {
        const tunnels = this.options.additionalTunnels;
        if (!tunnels?.length)
            return;
        for (const tunnel of tunnels) {
            const msg = {
                type: "register-tunnel",
                subdomain: tunnel.subdomain,
                localPort: tunnel.port,
                auth: this.options.auth,
            };
            this.sendMsg(msg);
        }
    }
    async handleRequest(request) {
        const start = Date.now();
        const targetPort = request.subdomain
            ? (this.subdomainPortMap.get(request.subdomain) ?? this.options.localPort)
            : this.options.localPort;
        const stream = proxyRequestStream(request, targetPort, {
            send: (msg) => this.sendMsg(msg),
            bufferedAmount: () => this.socket?.bufferedAmount ?? 0,
        }, this.options.localHost);
        this.activeStreams.set(request.id, stream);
        const result = await stream.done;
        this.activeStreams.delete(request.id);
        const durationMs = Date.now() - start;
        this.emit("request", {
            method: request.method,
            path: request.path,
            status: result.status,
            durationMs,
            subdomain: request.subdomain,
        });
        this.emit("inspector-entry", {
            id: request.id,
            timestamp: start,
            subdomain: request.subdomain,
            method: request.method,
            path: request.path,
            requestHeaders: request.headers,
            requestBody: request.body,
            status: result.status,
            responseHeaders: result.headers,
            responseBody: result.bodyPreview,
            durationMs,
            entryType: "normal",
        });
    }
    async reconnect() {
        // One retry loop at a time. Concurrent loops each hold their own `delay`,
        // so the backoff stops growing and the client hammers the server at the
        // base interval exactly when the server is least able to take it.
        if (this.reconnecting)
            return;
        this.reconnecting = true;
        this.subdomainPortMap.clear();
        let delay = DEFAULTS.RECONNECT_BASE_MS;
        try {
            while (!this.stopped) {
                this.attempts++;
                // Jitter: every tunnel on a restarted server wakes up together
                // otherwise, and they retry in lockstep for as long as it takes.
                const wait = Math.round(delay * (0.5 + Math.random() / 2));
                this.emit("reconnecting", { attempt: this.attempts, delay: wait });
                await new Promise((r) => setTimeout(r, wait));
                try {
                    await this.connect();
                    return;
                }
                catch (err) {
                    if (stopsReconnecting(err, this.options.kind)) {
                        this.stopped = true;
                        this.emit("error", err);
                        return;
                    }
                    delay = Math.min(delay * 2, DEFAULTS.RECONNECT_MAX_MS);
                }
            }
        }
        finally {
            this.reconnecting = false;
        }
    }
}
