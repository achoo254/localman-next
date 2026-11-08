import WebSocket from "ws";
import { DEFAULTS } from "./shared/constants.js";
import { stripHopByHopHeaders } from "./shared/http-headers.js";
import { readRefusal, unreachableRefusal, } from "./ws-app-refusal.js";
function toBuffer(data) {
    if (Buffer.isBuffer(data))
        return data;
    if (Array.isArray(data))
        return Buffer.concat(data);
    return Buffer.from(data);
}
function safeClose(ws, code, reason) {
    try {
        if (code && code >= 1000 && code <= 4999)
            ws.close(code, reason);
        else
            ws.close();
    }
    catch {
        ws.terminate();
    }
}
/** Handshake headers the `ws` client sets itself — must not be forwarded.
 *  `accept-encoding` too: a compressed refusal body would not survive the
 *  4 KiB cut on its way back to the browser. */
const WS_HANDSHAKE_HEADERS = [
    "host",
    "sec-websocket-key",
    "sec-websocket-version",
    "sec-websocket-extensions",
    "sec-websocket-protocol",
    "content-length",
    "accept-encoding",
];
/** Close code reported for a local WS that never opened (what `ws` reports). */
const ABNORMAL_CLOSURE = 1006;
/**
 * Client side of the WebSocket-to-app relay: opens a local WS per `ws-open`
 * and bridges frames both ways. Mirrors the server's connection model.
 *
 * Every `ws-open` gets one `ws-open-result`: a server that knows the message
 * answers the browser with it; an older server ignores it and acts on the
 * `ws-close` that follows a failure, exactly as before.
 */
export class WsAppProxy {
    send;
    resolvePort;
    options;
    conns = new Map();
    constructor(send, resolvePort, options = {}) {
        this.send = send;
        this.resolvePort = resolvePort;
        this.options = options;
    }
    open(msg) {
        const port = this.resolvePort(msg.subdomain);
        const headers = stripHopByHopHeaders(msg.headers);
        for (const h of WS_HANDSHAKE_HEADERS)
            delete headers[h];
        const url = `ws://${this.options.localHost ?? "localhost"}:${port}${msg.path}`;
        const protocols = msg.protocol
            ? msg.protocol
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined;
        const local = protocols
            ? new WebSocket(url, protocols, { headers })
            : new WebSocket(url, { headers });
        const timeoutMs = this.options.handshakeTimeoutMs ?? DEFAULTS.WS_APP_HANDSHAKE_TIMEOUT_MS;
        const conn = {
            ws: local,
            ready: false,
            queue: [],
            timedOut: false,
            // Past it, an app still sending its refusal body is answered with
            // what arrived; one that never answered gets 504 from the close.
            deadline: setTimeout(() => {
                conn.timedOut = true;
                if (conn.refusal)
                    this.fail(msg.id, conn.refusal);
                else
                    local.terminate();
            }, timeoutMs),
        };
        this.conns.set(msg.id, conn);
        local.on("open", () => {
            clearTimeout(conn.deadline);
            conn.ready = true;
            // First, so the server answers the browser before any app frame.
            this.send({
                type: "ws-open-result",
                id: msg.id,
                ok: true,
                ...(local.protocol ? { protocol: local.protocol } : {}),
            });
            for (const q of conn.queue) {
                local.send(Buffer.from(q.data, "base64"), { binary: q.binary });
            }
            conn.queue = [];
        });
        local.on("unexpected-response", (_req, res) => {
            conn.refusal = readRefusal(msg.id, res, (refusal) => this.fail(msg.id, refusal));
        });
        local.on("message", (data, isBinary) => {
            this.send({
                type: "ws-data",
                id: msg.id,
                data: toBuffer(data).toString("base64"),
                binary: isBinary,
            });
        });
        local.on("close", (code, reason) => {
            if (!conn.ready) {
                this.fail(msg.id, conn.refusal ?? unreachableRefusal(msg.id, conn.timedOut));
                return;
            }
            if (!this.conns.delete(msg.id))
                return;
            this.send({
                type: "ws-close",
                id: msg.id,
                code,
                reason: reason.toString(),
            });
        });
        // A close event follows every error; nothing to forward here.
        local.on("error", () => undefined);
    }
    data(msg) {
        const conn = this.conns.get(msg.id);
        if (!conn)
            return;
        if (conn.ready && conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(Buffer.from(msg.data, "base64"), { binary: msg.binary });
            return;
        }
        // Local WS not open yet — buffer, but bound it so a stalled handshake
        // can't grow memory without limit.
        if (conn.queue.length >= DEFAULTS.WS_APP_PREOPEN_QUEUE_MAX) {
            conn.ws.close();
            return;
        }
        conn.queue.push(msg);
    }
    close(msg) {
        const conn = this.conns.get(msg.id);
        if (!conn)
            return;
        this.conns.delete(msg.id);
        clearTimeout(conn.deadline);
        safeClose(conn.ws, msg.code, msg.reason);
    }
    /** Control socket dropped — tear down all local WS connections. */
    closeAll() {
        for (const conn of this.conns.values()) {
            clearTimeout(conn.deadline);
            conn.ws.close();
        }
        this.conns.clear();
    }
    /**
     * Report a local WS that never opened: the result for servers that know
     * it, then the `ws-close` older servers act on. Once per connection.
     */
    fail(id, result) {
        const conn = this.conns.get(id);
        if (!conn)
            return;
        this.conns.delete(id);
        clearTimeout(conn.deadline);
        this.send(result);
        this.send({ type: "ws-close", id, code: ABNORMAL_CLOSURE, reason: "" });
        // Aborts a handshake still in flight; a no-op on one that is over.
        conn.ws.terminate();
    }
}
