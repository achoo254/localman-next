import {
	DEFAULTS,
	type WsCloseMessage,
	type WsDataMessage,
	type WsOpenMessage,
	stripHopByHopHeaders,
} from "@tunelo/shared";
import WebSocket, { type RawData } from "ws";

export type WsAppSend = (msg: WsDataMessage | WsCloseMessage) => void;

interface LocalConn {
	ws: WebSocket;
	ready: boolean;
	/** Frames from the browser that arrived before the local WS finished opening. */
	queue: WsDataMessage[];
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

/** Handshake headers the `ws` client sets itself — must not be forwarded. */
const WS_HANDSHAKE_HEADERS = [
	"host",
	"sec-websocket-key",
	"sec-websocket-version",
	"sec-websocket-extensions",
	"sec-websocket-protocol",
	"content-length",
];

/**
 * Client side of the WebSocket-to-app relay: opens a local WS per `ws-open`
 * and bridges frames both ways. Mirrors the server's connection model.
 */
export class WsAppProxy {
	private conns = new Map<string, LocalConn>();

	constructor(
		private readonly send: WsAppSend,
		private readonly resolvePort: (subdomain: string) => number,
	) {}

	open(msg: WsOpenMessage): void {
		const port = this.resolvePort(msg.subdomain);
		const headers = stripHopByHopHeaders(msg.headers);
		for (const h of WS_HANDSHAKE_HEADERS) delete headers[h];

		const url = `ws://localhost:${port}${msg.path}`;
		const protocols = msg.protocol
			? msg.protocol
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: undefined;
		const opts = {
			headers,
			handshakeTimeout: DEFAULTS.WS_APP_HANDSHAKE_TIMEOUT_MS,
		};
		const local = protocols
			? new WebSocket(url, protocols, opts)
			: new WebSocket(url, opts);

		const conn: LocalConn = { ws: local, ready: false, queue: [] };
		this.conns.set(msg.id, conn);

		local.on("open", () => {
			conn.ready = true;
			for (const q of conn.queue) {
				local.send(Buffer.from(q.data, "base64"), { binary: q.binary });
			}
			conn.queue = [];
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
			if (!this.conns.delete(msg.id)) return;
			this.send({
				type: "ws-close",
				id: msg.id,
				code,
				reason: reason.toString(),
			});
		});
		local.on("error", () => {
			// A close event follows; nothing to forward here.
		});
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
		safeClose(conn.ws, msg.code, msg.reason);
	}

	/** Control socket dropped — tear down all local WS connections. */
	closeAll(): void {
		for (const conn of this.conns.values()) conn.ws.close();
		this.conns.clear();
	}
}
