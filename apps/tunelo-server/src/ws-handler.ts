import { AsyncResource } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type http from "node:http";
import type { Duplex } from "node:stream";
import {
	type ClientToServerMessage,
	DEFAULTS,
	WS_CLOSE_CODES,
	parseMessage,
} from "@tunelo/shared";
import { type RawData, type WebSocket, WebSocketServer } from "ws";
import type { TokenAuthenticator } from "./auth/token-authenticator.js";
import { createLogger } from "./logger.js";
import { extractSubdomain } from "./request-relay.js";
import {
	cleanupTcpState,
	createTcpState,
	handleTcpConnectionClose,
	handleTcpData,
	handleTcpRegister,
} from "./tcp-ws-handler.js";
import { tenantDirectory } from "./tenancy/tenant-directory.js";
import { type TunnelTenant, runInTenant } from "./tenancy/tunnel-tenant.js";
import { tunnelManager } from "./tunnel-manager.js";
import { wsAppRelay } from "./ws-app-relay.js";
import type { ConnectionState } from "./ws-connection-state.js";
import {
	isAuthMessage,
	isRegisterTunnelMessage,
	isTcpRegisterMessage,
} from "./ws-message-guards.js";
import {
	allowTcpRegister,
	handleRegisterTunnel,
} from "./ws-register-tunnel.js";
import { safeSend } from "./ws-send.js";
import { handleAuth } from "./ws-tunnel-auth.js";

const logger = createLogger("tunelo-ws");

/**
 * Refuse a WebSocket upgrade with a real HTTP response.
 *
 * Destroying the socket without writing anything leaves the peer reading a
 * response header that never arrives: a reverse proxy reports "upstream
 * prematurely closed connection" and the browser sees a reset instead of a
 * status it can act on. Mirrors the plain-HTTP relay, which answers the same
 * conditions with 400/502.
 */
function rejectUpgrade(
	socket: Duplex,
	statusLine: string,
	message: string,
	extraHeaders: Record<string, string> = {},
): void {
	const body = `${message}\n`;
	const headers = {
		"content-type": "text/plain",
		"content-length": String(Buffer.byteLength(body)),
		connection: "close",
		...extraHeaders,
	};
	const headerLines = Object.entries(headers)
		.map(([name, value]) => `${name}: ${value}\r\n`)
		.join("");
	socket.write(`HTTP/1.1 ${statusLine}\r\n${headerLines}\r\n${body}`);
	socket.destroy();
}

export function attachWsHandler(
	server: http.Server,
	authenticator: TokenAuthenticator,
): void {
	const wss = new WebSocketServer({
		noServer: true,
		maxPayload: DEFAULTS.MAX_BODY_SIZE,
	});
	// Browser→app WebSocket relay (echoes the first requested subprotocol so
	// subprotocol-based clients — e.g. socket.io — handshake cleanly).
	const appWss = new WebSocketServer({
		noServer: true,
		maxPayload: DEFAULTS.MAX_BODY_SIZE,
		handleProtocols: (protocols) => protocols.values().next().value ?? false,
	});

	// The tenant of each control channel, from its upgrade request's Host.
	const tenants = new WeakMap<http.IncomingMessage, TunnelTenant>();

	server.on("upgrade", (req, socket, head) => {
		void tenantDirectory()
			.byHost(req.headers.host ?? "")
			.catch(() => undefined)
			.then((tenant) => {
				if (!tenant) {
					rejectUpgrade(socket, "421 Misdirected Request", "Unknown host");
					return;
				}
				tenants.set(req, tenant);
				runInTenant(tenant, () => upgradeInTenant(req, socket, head));
			});
	});

	function upgradeInTenant(
		req: http.IncomingMessage,
		socket: Duplex,
		head: Buffer,
	): void {
		const url = new URL(req.url ?? "/", "http://localhost");
		const subdomain = extractSubdomain(req.headers.host ?? "");

		// Control channel: reserved /tunnel path on the apex host (no subdomain).
		if (url.pathname === DEFAULTS.WS_PATH && !subdomain) {
			wss.handleUpgrade(req, socket, head, (ws) => {
				wss.emit("connection", ws, req);
			});
			return;
		}

		// Browser WebSocket to a tunneled app → relay through the control socket.
		if (subdomain && tunnelManager.has(subdomain)) {
			if (!tunnelManager.checkAuth(subdomain, req.headers.authorization)) {
				rejectUpgrade(socket, "401 Unauthorized", "Unauthorized", {
					"www-authenticate": 'Basic realm="tunelo"',
				});
				return;
			}
			const proto = req.headers["sec-websocket-protocol"];
			appWss.handleUpgrade(req, socket, head, (browserWs) => {
				wsAppRelay.register(
					browserWs,
					subdomain,
					url.pathname + url.search,
					req.headers as Record<string, string | string[]>,
					Array.isArray(proto) ? proto.join(", ") : proto,
				);
			});
			return;
		}

		// No control channel and no live tunnel — answer instead of hanging up.
		// A silent destroy left no trace in the relay log while the proxy logged
		// thousands of "upstream prematurely closed connection" errors.
		if (!subdomain) {
			logger.warn(
				{ host: req.headers.host, path: url.pathname },
				"WS upgrade rejected: no tunnel subdomain in Host header",
			);
			rejectUpgrade(
				socket,
				"400 Bad Request",
				"Bad Request: no tunnel subdomain in Host header",
			);
			return;
		}

		logger.warn(
			{ subdomain, path: url.pathname },
			"WS upgrade rejected: tunnel not found",
		);
		rejectUpgrade(socket, "502 Bad Gateway", `Tunnel not found: ${subdomain}`);
	}

	wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
		const tenant = tenants.get(req);
		if (!tenant) {
			ws.close(WS_CLOSE_CODES.AUTH_FAILED, "Unknown host");
			return;
		}
		runInTenant(tenant, () => onControlChannel(ws));
	});

	/** A control channel, set up in its tenant; its messages run there too. */
	function onControlChannel(ws: WebSocket): void {
		const state: ConnectionState = {
			id: randomUUID(),
			authStarted: false,
			authenticated: false,
			subdomain: "",
			keyInfo: null,
			owner: null,
			messageCount: 0,
			rateLimitInterval: setInterval(() => {
				state.messageCount = 0;
			}, 1000),
			authTimer: setTimeout(() => {
				if (!state.authenticated) {
					safeSend(ws, {
						type: "auth-result",
						success: false,
						subdomain: "",
						url: "",
						error: "Auth timeout",
					});
					ws.close(WS_CLOSE_CODES.AUTH_TIMEOUT, "Auth timeout");
				}
			}, 10_000),
			pingInterval: null,
			tcpState: createTcpState(),
			alive: true,
		};

		// Native ping/pong keepalive
		state.pingInterval = setInterval(() => {
			if (!state.alive) {
				ws.terminate();
				return;
			}
			state.alive = false;
			ws.ping();
		}, DEFAULTS.PING_INTERVAL_MS);

		ws.on("pong", () => {
			state.alive = true;
		});

		ws.on(
			"message",
			AsyncResource.bind((data: RawData) => {
				state.messageCount++;
				if (state.messageCount > DEFAULTS.WS_RATE_LIMIT) {
					logger.warn({ subdomain: state.subdomain }, "Rate limit exceeded");
					return;
				}

				let msg: ClientToServerMessage;
				try {
					msg = parseMessage(data.toString()) as ClientToServerMessage;
				} catch {
					logger.warn({ connectionId: state.id }, "Invalid JSON message");
					return;
				}

				switch (msg.type) {
					case "auth":
						if (!isAuthMessage(msg)) {
							logger.warn({ connectionId: state.id }, "Malformed auth message");
							ws.close(WS_CLOSE_CODES.AUTH_FAILED, "Malformed auth message");
							return;
						}
						void handleAuth(ws, state, msg, authenticator);
						break;
					case "register-tunnel":
						if (!isRegisterTunnelMessage(msg)) return;
						handleRegisterTunnel(ws, state, msg);
						break;
					case "response":
						if (!state.authenticated) return;
						tunnelManager.handleResponseByConnectionId(state.id, msg);
						break;
					case "stream-start":
					case "stream-data":
					case "stream-end":
					case "stream-error":
						if (!state.authenticated) return;
						tunnelManager.handleStreamFrame(msg);
						break;
					case "tcp-register":
						if (!state.authenticated || !state.owner || !state.keyInfo) return;
						if (!isTcpRegisterMessage(msg)) return;
						if (!allowTcpRegister(ws, state.keyInfo, msg.localPort)) return;
						handleTcpRegister(ws, state.id, msg, state.tcpState, state.owner);
						break;
					case "tcp-data":
						if (!state.authenticated) return;
						handleTcpData(msg, state.tcpState);
						break;
					case "tcp-connection-close":
						if (!state.authenticated) return;
						handleTcpConnectionClose(msg, state.tcpState);
						break;
					case "ws-data":
						if (!state.authenticated) return;
						wsAppRelay.handleData(msg);
						break;
					case "ws-close":
						if (!state.authenticated) return;
						wsAppRelay.handleClose(msg);
						break;
					case "pong":
						break;
					default:
						break;
				}
			}),
		);

		ws.on("close", () => {
			clearTimeout(state.authTimer);
			clearInterval(state.rateLimitInterval);
			if (state.pingInterval) clearInterval(state.pingInterval);
			cleanupTcpState(state.tcpState);
			// Always: a `tcpOnly` channel may still have used `register-tunnel`.
			tunnelManager.unregisterByConnectionId(state.id);
			wsAppRelay.cleanupByConnection(state.id);
		});

		ws.on("error", (err) => {
			logger.error({ err, subdomain: state.subdomain }, "Socket error");
		});
	}
}
