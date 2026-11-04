import { randomUUID } from "node:crypto";
import {
	DEFAULTS,
	type WsCloseMessage,
	type WsDataMessage,
	type WsOpenMessage,
	type WsOpenResultMessage,
} from "@tunelo/shared";
import {
	type HeldSocket,
	type HeldUpgrade,
	guardWrites,
	holdSocket,
} from "./held-upgrade-socket.js";
import { createLogger } from "./logger.js";
import { type TunnelConnection, tunnelManager } from "./tunnel-manager.js";
import { wsAppRelay } from "./ws-app-relay.js";
import { safeSend } from "./ws-send.js";
import { rejectUpgrade, writeAppRefusal } from "./ws-upgrade-response.js";

const logger = createLogger("tunelo-ws-handshake");

/** RFC 6455 "Going Away": the browser left before the app answered. */
const GOING_AWAY = 1001;

interface Pending {
	tunnel: TunnelConnection;
	upgrade: HeldUpgrade;
	held: HeldSocket;
	/** App frames that arrived before the browser socket was upgraded. */
	queue: WsDataMessage[];
	timer: ReturnType<typeof setTimeout>;
	/** Set once the app accepted; the socket belongs to `ws` from then on. */
	accepting: boolean;
}

/**
 * Browser upgrades held until the tunnel client reports how its local WS
 * opened. The browser gets `101` only when the app accepted, and the app's
 * own status otherwise — never a `101` followed by a close. Used only for
 * clients that declared `CLIENT_CAPABILITIES.WS_OPEN_RESULT`.
 */
class WsAppHandshakes {
	private pending = new Map<string, Pending>();

	begin(upgrade: HeldUpgrade): void {
		const { socket, subdomain, path } = upgrade;
		const tunnel = tunnelManager.get(subdomain);
		if (!tunnel) {
			rejectUpgrade(
				socket,
				"502 Bad Gateway",
				`Tunnel not found: ${subdomain}`,
			);
			return;
		}
		// Same cap as the relay, held upgrades included, before the app is asked.
		const count =
			wsAppRelay.countFor(tunnel.connectionId) +
			this.countFor(tunnel.connectionId);
		if (count >= DEFAULTS.WS_APP_MAX_PER_TUNNEL) {
			logger.warn({ subdomain, count }, "Browser WS cap reached");
			rejectUpgrade(socket, "503 Service Unavailable", "Too many connections");
			return;
		}

		const id = randomUUID();
		const entry: Pending = {
			tunnel,
			upgrade,
			held: holdSocket(socket, (reason) => this.abandon(id, reason)),
			queue: [],
			accepting: false,
			timer: setTimeout(
				() =>
					this.refuse(id, "504 Gateway Timeout", "App did not answer in time"),
				upgrade.timeoutMs ?? DEFAULTS.WS_APP_OPEN_RESULT_TIMEOUT_MS,
			),
		};
		this.pending.set(id, entry);

		safeSend(tunnel.socket, {
			type: "ws-open",
			id,
			subdomain,
			path,
			headers: upgrade.headers,
			protocol: upgrade.protocol,
		} satisfies WsOpenMessage);
	}

	/** The client reports how the local WS opened. */
	handleResult(connectionId: string, msg: WsOpenResultMessage): void {
		const entry = this.pending.get(msg.id);
		if (!entry || entry.accepting) return;
		if (entry.tunnel.connectionId !== connectionId) return;
		const { subdomain, path, socket } = entry.upgrade;

		if (!msg.ok) {
			this.take(msg.id);
			guardWrites(socket);
			writeAppRefusal(socket, msg);
			logger.info(
				{ subdomain, path, status: msg.status },
				"Browser WS rejected by app",
			);
			return;
		}

		clearTimeout(entry.timer);
		entry.accepting = true;
		// "end"/"close" stay watched: if `ws` refuses the handshake itself it
		// destroys the socket without calling back, and the client must hear.
		entry.held.stopReading();
		const head = Buffer.concat([entry.upgrade.head, ...entry.held.early()]);
		entry.upgrade.accept(head, msg.protocol, (browserWs) => {
			if (!this.take(msg.id)) {
				browserWs.terminate();
				return;
			}
			wsAppRelay.bridge(msg.id, browserWs, entry.tunnel, subdomain, path);
			for (const frame of entry.queue)
				wsAppRelay.handleData(connectionId, frame);
		});
	}

	/** App frame for a held upgrade: queue it (bounded); true if it was one. */
	handleData(connectionId: string, msg: WsDataMessage): boolean {
		const entry = this.pending.get(msg.id);
		if (!entry) return false;
		if (entry.tunnel.connectionId !== connectionId) return true;
		if (entry.queue.length >= DEFAULTS.WS_APP_PREOPEN_QUEUE_MAX) {
			this.refuse(msg.id, "502 Bad Gateway", "Too many frames before open");
			return true;
		}
		entry.queue.push(msg);
		return true;
	}

	/** The local WS closed before any result: the app is unreachable. */
	handleClose(connectionId: string, msg: WsCloseMessage): boolean {
		const entry = this.pending.get(msg.id);
		if (!entry) return false;
		if (entry.tunnel.connectionId !== connectionId) return true;
		if (entry.accepting) return true;
		this.refuse(msg.id, "502 Bad Gateway", "Bad Gateway", false);
		return true;
	}

	/** Control WS dropped: answer every upgrade it was holding. */
	cleanupByConnection(connectionId: string): void {
		for (const [id, entry] of this.pending) {
			if (entry.tunnel.connectionId !== connectionId) continue;
			this.refuse(id, "502 Bad Gateway", "Tunnel connection lost", false);
		}
	}

	countFor(connectionId: string): number {
		let count = 0;
		for (const entry of this.pending.values()) {
			if (entry.tunnel.connectionId === connectionId) count++;
		}
		return count;
	}

	/** Answer the browser ourselves; tell the client to drop its attempt. */
	private refuse(
		id: string,
		statusLine: string,
		message: string,
		notifyClient = true,
	): void {
		const entry = this.take(id);
		if (!entry) return;
		const { socket, subdomain, path } = entry.upgrade;
		guardWrites(socket);
		rejectUpgrade(socket, statusLine, message);
		if (notifyClient) {
			safeSend(entry.tunnel.socket, { type: "ws-close", id, code: GOING_AWAY });
		}
		logger.warn({ subdomain, path, status: statusLine }, "Browser WS rejected");
	}

	/** The browser went away while waiting: drop it, close the local WS. */
	private abandon(id: string, reason: string): void {
		const entry = this.take(id);
		if (!entry) return;
		const { socket, subdomain, path } = entry.upgrade;
		guardWrites(socket);
		socket.destroy();
		safeSend(entry.tunnel.socket, {
			type: "ws-close",
			id,
			code: GOING_AWAY,
			reason,
		});
		logger.info({ subdomain, path, reason }, "Browser WS abandoned");
	}

	private take(id: string): Pending | undefined {
		const entry = this.pending.get(id);
		if (!entry) return undefined;
		this.pending.delete(id);
		clearTimeout(entry.timer);
		entry.held.release();
		return entry;
	}
}

export const wsAppHandshakes = new WsAppHandshakes();
