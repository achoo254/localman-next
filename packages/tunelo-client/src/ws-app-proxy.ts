import type http from "node:http";
import WebSocket, { type RawData } from "ws";
import { DEFAULTS } from "./shared/constants.js";
import { stripHopByHopHeaders } from "./shared/http-headers.js";
import type {
	WsCloseMessage,
	WsDataMessage,
	WsOpenMessage,
	WsOpenResultMessage,
} from "./shared/protocol.js";
import {
	type WsOpenRefusal,
	readRefusal,
	unreachableRefusal,
} from "./ws-app-refusal.js";

export type WsAppSend = (
	msg: WsDataMessage | WsCloseMessage | WsOpenResultMessage,
) => void;

interface LocalConn {
	ws: WebSocket;
	ready: boolean;
	/** Frames from the browser that arrived before the local WS finished opening. */
	queue: WsDataMessage[];
	/** Caps the whole opening handshake, TCP connect included. */
	deadline: ReturnType<typeof setTimeout>;
	/** Set by the deadline, so the failure that follows reads as a timeout. */
	timedOut: boolean;
	/** The app's non-101 answer, once its headers arrived. */
	refusal?: WsOpenRefusal;
}

function toBuffer(data: RawData): Buffer {
	if (Buffer.isBuffer(data)) return data;
	if (Array.isArray(data)) return Buffer.concat(data);
	return Buffer.from(data as ArrayBuffer);
}

function safeClose(ws: WebSocket, code?: number, reason?: string): void {
	try {
		if (code && code >= 1000 && code <= 4999) ws.close(code, reason);
		else ws.close();
	} catch {
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

export interface WsAppProxyOptions {
	/** Cap on the local handshake (ms). Overridden only by tests. */
	handshakeTimeoutMs?: number;
	/** Host the local app listens on; default `localhost`. */
	localHost?: string | undefined;
}

/**
 * Client side of the WebSocket-to-app relay: opens a local WS per `ws-open`
 * and bridges frames both ways. Mirrors the server's connection model.
 *
 * Every `ws-open` gets one `ws-open-result`: a server that knows the message
 * answers the browser with it; an older server ignores it and acts on the
 * `ws-close` that follows a failure, exactly as before.
 */
export class WsAppProxy {
	private conns = new Map<string, LocalConn>();

	constructor(
		private readonly send: WsAppSend,
		private readonly resolvePort: (subdomain: string) => number,
		private readonly options: WsAppProxyOptions = {},
	) {}

	open(msg: WsOpenMessage): void {
		const port = this.resolvePort(msg.subdomain);
		const headers = stripHopByHopHeaders(msg.headers);
		for (const h of WS_HANDSHAKE_HEADERS) delete headers[h];

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

		const timeoutMs =
			this.options.handshakeTimeoutMs ?? DEFAULTS.WS_APP_HANDSHAKE_TIMEOUT_MS;
		const conn: LocalConn = {
			ws: local,
			ready: false,
			queue: [],
			timedOut: false,
			// Past it, an app still sending its refusal body is answered with
			// what arrived; one that never answered gets 504 from the close.
			deadline: setTimeout(() => {
				conn.timedOut = true;
				if (conn.refusal) this.fail(msg.id, conn.refusal);
				else local.terminate();
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
		local.on("unexpected-response", (_req, res: http.IncomingMessage) => {
			conn.refusal = readRefusal(msg.id, res, (refusal) =>
				this.fail(msg.id, refusal),
			);
		});
		local.on("message", (data: RawData, isBinary: boolean) => {
			this.send({
				type: "ws-data",
				id: msg.id,
				data: toBuffer(data).toString("base64"),
				binary: isBinary,
			});
		});
		local.on("close", (code: number, reason: Buffer) => {
			if (!conn.ready) {
				this.fail(
					msg.id,
					conn.refusal ?? unreachableRefusal(msg.id, conn.timedOut),
				);
				return;
			}
			if (!this.conns.delete(msg.id)) return;
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

	data(msg: WsDataMessage): void {
		const conn = this.conns.get(msg.id);
		if (!conn) return;
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

	close(msg: WsCloseMessage): void {
		const conn = this.conns.get(msg.id);
		if (!conn) return;
		this.conns.delete(msg.id);
		clearTimeout(conn.deadline);
		safeClose(conn.ws, msg.code, msg.reason);
	}

	/** Control socket dropped — tear down all local WS connections. */
	closeAll(): void {
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
	private fail(id: string, result: WsOpenRefusal): void {
		const conn = this.conns.get(id);
		if (!conn) return;
		this.conns.delete(id);
		clearTimeout(conn.deadline);
		this.send(result);
		this.send({ type: "ws-close", id, code: ABNORMAL_CLOSURE, reason: "" });
		// Aborts a handshake still in flight; a no-op on one that is over.
		conn.ws.terminate();
	}
}
