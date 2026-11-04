import { randomUUID } from "node:crypto";
import {
	DEFAULTS,
	type WsCloseMessage,
	type WsDataMessage,
	type WsOpenMessage,
} from "@tunelo/shared";
import type { RawData, WebSocket } from "ws";
import { createLogger } from "./logger.js";
import { type TunnelConnection, tunnelManager } from "./tunnel-manager.js";
import { safeSend } from "./ws-send.js";

const logger = createLogger("tunelo-ws-app");

interface BrowserConn {
	socket: WebSocket;
	/** Control connection id of the owning tunnel (for cleanup on disconnect). */
	connectionId: string;
	/** Keepalive liveness flag, reset on each pong. */
	alive: boolean;
	pingTimer?: ReturnType<typeof setInterval>;
}

function toBuffer(data: RawData): Buffer {
	if (Buffer.isBuffer(data)) return data;
	if (Array.isArray(data)) return Buffer.concat(data);
	return Buffer.from(data as ArrayBuffer);
}

/** Close a browser socket, falling back to a no-code close for reserved codes. */
function safeCloseSocket(
	socket: WebSocket,
	code?: number,
	reason?: string,
): void {
	try {
		if (code && code >= 1000 && code <= 4999) socket.close(code, reason);
		else socket.close();
	} catch {
		socket.terminate();
	}
}

/**
 * Bridges browser WebSocket connections through a tunnel's control socket to
 * the client's local WS server. Direction-agnostic frames keyed by id, mirrors
 * the TCP relay's connection model. Singleton — the upgrade handler and the
 * client-frame dispatcher both talk to it.
 */
class WsAppRelay {
	private conns = new Map<string, BrowserConn>();

	/** A browser WS was accepted for `subdomain`; ask the client to open the local WS. */
	register(
		browserWs: WebSocket,
		subdomain: string,
		path: string,
		headers: Record<string, string | string[]>,
		protocol: string | undefined,
	): void {
		const tunnel = tunnelManager.get(subdomain);
		if (!tunnel) {
			browserWs.close();
			return;
		}

		// Cap concurrent browser WS per tunnel — DoS guard (mirrors TCP relay).
		const count = this.countFor(tunnel.connectionId);
		if (count >= DEFAULTS.WS_APP_MAX_PER_TUNNEL) {
			logger.warn({ subdomain, count }, "Browser WS cap reached");
			safeCloseSocket(browserWs, 1013, "Too many connections");
			return;
		}

		const id = randomUUID();
		this.bridge(id, browserWs, tunnel, subdomain, path);
		safeSend(tunnel.socket, {
			type: "ws-open",
			id,
			subdomain,
			path,
			headers,
			protocol,
		} satisfies WsOpenMessage);
	}

	/** Bridged browser sockets of one control connection. */
	countFor(connectionId: string): number {
		let count = 0;
		for (const c of this.conns.values()) {
			if (c.connectionId === connectionId) count++;
		}
		return count;
	}

	/**
	 * Relay frames between an upgraded browser socket and the client's local
	 * WS `id`, with keepalive; frames from either side flow from here on.
	 */
	bridge(
		id: string,
		browserWs: WebSocket,
		tunnel: TunnelConnection,
		subdomain: string,
		path: string,
	): void {
		const conn: BrowserConn = {
			socket: browserWs,
			connectionId: tunnel.connectionId,
			alive: true,
		};
		this.conns.set(id, conn);

		// Keepalive — reap half-open browser sockets (client vanished without FIN).
		conn.pingTimer = setInterval(() => {
			if (!conn.alive) {
				browserWs.terminate();
				return;
			}
			conn.alive = false;
			browserWs.ping();
		}, DEFAULTS.PING_INTERVAL_MS);
		browserWs.on("pong", () => {
			conn.alive = true;
		});

		browserWs.on("message", (data: RawData, isBinary: boolean) => {
			safeSend(tunnel.socket, {
				type: "ws-data",
				id,
				data: toBuffer(data).toString("base64"),
				binary: isBinary,
			});
		});
		browserWs.on("close", (code: number, reason: Buffer) => {
			if (!this.teardown(id)) return;
			safeSend(tunnel.socket, {
				type: "ws-close",
				id,
				code,
				reason: reason.toString(),
			});
		});
		browserWs.on("error", (err) => {
			logger.warn({ err, subdomain }, "Browser WS error");
		});

		logger.info({ subdomain, path }, "Browser WS bridged");
	}

	/** Frame from the local app (via client) → forward to the browser. */
	handleData(connectionId: string, msg: WsDataMessage): void {
		const conn = this.conns.get(msg.id);
		if (!conn || conn.connectionId !== connectionId) return;
		if (conn.socket.readyState !== conn.socket.OPEN) return;
		conn.socket.send(Buffer.from(msg.data, "base64"), { binary: msg.binary });
	}

	/** Local app closed the WS → close the browser side. */
	handleClose(connectionId: string, msg: WsCloseMessage): void {
		if (this.conns.get(msg.id)?.connectionId !== connectionId) return;
		const conn = this.teardown(msg.id);
		if (conn) safeCloseSocket(conn.socket, msg.code, msg.reason);
	}

	/** Control WS dropped → close every browser WS bridged over it. */
	cleanupByConnection(connectionId: string): void {
		for (const [id, conn] of this.conns) {
			if (conn.connectionId !== connectionId) continue;
			this.teardown(id);
			conn.socket.close();
		}
	}

	/** Remove an entry and stop its keepalive; returns the entry if it existed. */
	private teardown(id: string): BrowserConn | undefined {
		const conn = this.conns.get(id);
		if (!conn) return undefined;
		this.conns.delete(id);
		if (conn.pingTimer) clearInterval(conn.pingTimer);
		return conn;
	}
}

export const wsAppRelay = new WsAppRelay();
