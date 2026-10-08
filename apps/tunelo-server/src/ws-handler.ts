import { createHash, randomUUID } from "node:crypto";
import type http from "node:http";
import type { Duplex } from "node:stream";
import {
	type AuthMessage,
	type ClientToServerMessage,
	DEFAULTS,
	ErrorCode,
	type RegisterTunnelMessage,
	SUBDOMAIN_REGEX,
	WS_CLOSE_CODES,
	buildTunnelUrl,
	parseMessage,
} from "@tunelo/shared";
import { customAlphabet } from "nanoid";
import { type WebSocket, WebSocketServer } from "ws";
import type { KeyInfo, KeyStore } from "./key-store/key-store-types.js";
import { createLogger } from "./logger.js";
import { extractSubdomain } from "./request-relay.js";
import {
	type TcpConnectionState,
	cleanupTcpState,
	createTcpState,
	handleTcpConnectionClose,
	handleTcpData,
	handleTcpRegister,
} from "./tcp-ws-handler.js";
import { tunnelManager } from "./tunnel-manager.js";
import { wsAppRelay } from "./ws-app-relay.js";
import { safeSend } from "./ws-send.js";

const generateSubdomain = customAlphabet(
	"abcdefghijklmnopqrstuvwxyz0123456789",
	8,
);
const logger = createLogger("tunelo-ws");

function hashKey(key: string): string {
	return createHash("sha256").update(key).digest("hex");
}

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

/** Per-connection state attached after upgrade */
interface ConnectionState {
	id: string;
	authenticated: boolean;
	subdomain: string;
	keyInfo: KeyInfo | null;
	messageCount: number;
	rateLimitInterval: ReturnType<typeof setInterval>;
	authTimer: ReturnType<typeof setTimeout>;
	pingInterval: ReturnType<typeof setInterval> | null;
	tcpState: TcpConnectionState;
	alive: boolean;
}

export function attachWsHandler(server: http.Server, keyStore: KeyStore): void {
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

	server.on("upgrade", (req, socket, head) => {
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
	});

	wss.on("connection", (ws: WebSocket) => {
		const state: ConnectionState = {
			id: randomUUID(),
			authenticated: false,
			subdomain: "",
			keyInfo: null,
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

		ws.on("message", (data) => {
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
					handleAuth(ws, state, msg, keyStore);
					break;
				case "register-tunnel":
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
					if (!state.authenticated) return;
					handleTcpRegister(ws, state.id, msg, state.tcpState);
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
		});

		ws.on("close", () => {
			clearTimeout(state.authTimer);
			clearInterval(state.rateLimitInterval);
			if (state.pingInterval) clearInterval(state.pingInterval);
			cleanupTcpState(state.tcpState);
			if (state.subdomain) tunnelManager.unregisterByConnectionId(state.id);
			wsAppRelay.cleanupByConnection(state.id);
		});

		ws.on("error", (err) => {
			logger.error({ err, subdomain: state.subdomain }, "Socket error");
		});
	});
}

async function handleAuth(
	ws: WebSocket,
	state: ConnectionState,
	msg: AuthMessage,
	keyStore: KeyStore,
): Promise<void> {
	if (state.authenticated) return;
	clearTimeout(state.authTimer);

	const keyHash = hashKey(msg.key);
	const keyInfo = await keyStore.validate(keyHash);

	if (!keyInfo) {
		safeSend(ws, {
			type: "auth-result",
			success: false,
			subdomain: "",
			url: "",
			error: "Invalid API key",
		});
		ws.close(WS_CLOSE_CODES.AUTH_FAILED, "Invalid API key");
		return;
	}

	// Enforce maxTunnelsPerKey
	const currentCount = tunnelManager.countByKeyHash(keyHash);
	if (currentCount >= keyInfo.maxTunnels) {
		safeSend(ws, {
			type: "auth-result",
			success: false,
			subdomain: "",
			url: "",
			error: "Max tunnels per key exceeded",
		});
		ws.close(WS_CLOSE_CODES.AUTH_FAILED, "Max tunnels exceeded");
		return;
	}

	const requestedSubdomain = msg.subdomain || generateSubdomain();

	if (!SUBDOMAIN_REGEX.test(requestedSubdomain)) {
		safeSend(ws, {
			type: "auth-result",
			success: false,
			subdomain: requestedSubdomain,
			url: "",
			error: "Invalid subdomain format",
		});
		ws.close(WS_CLOSE_CODES.AUTH_FAILED, "Invalid subdomain");
		return;
	}

	if (
		!tunnelManager.register(
			requestedSubdomain,
			ws,
			state.id,
			keyHash,
			keyInfo.userId,
			keyInfo.keyId,
			msg.auth,
		)
	) {
		safeSend(ws, {
			type: "auth-result",
			success: false,
			subdomain: requestedSubdomain,
			url: "",
			error: "Subdomain already in use",
		});
		ws.close(WS_CLOSE_CODES.SUBDOMAIN_TAKEN, "Subdomain taken");
		return;
	}

	state.authenticated = true;
	state.subdomain = requestedSubdomain;
	state.keyInfo = keyInfo;
	const url = buildTunnelUrl(requestedSubdomain);

	safeSend(ws, {
		type: "auth-result",
		success: true,
		subdomain: requestedSubdomain,
		url,
	});
	logger.info({ subdomain: requestedSubdomain, url }, "Client authenticated");
}

function handleRegisterTunnel(
	ws: WebSocket,
	state: ConnectionState,
	msg: RegisterTunnelMessage,
): void {
	if (!state.authenticated || !state.keyInfo) return;

	const requestedSubdomain = msg.subdomain || generateSubdomain();

	if (!SUBDOMAIN_REGEX.test(requestedSubdomain)) {
		safeSend(ws, {
			type: "register-tunnel-result",
			success: false,
			subdomain: requestedSubdomain,
			localPort: msg.localPort,
			url: "",
			error: "Invalid subdomain format",
		});
		return;
	}

	// Enforce maxTunnelsPerKey
	const currentCount = tunnelManager.countByKeyHash(state.keyInfo.keyHash);
	if (currentCount >= state.keyInfo.maxTunnels) {
		safeSend(ws, {
			type: "register-tunnel-result",
			success: false,
			subdomain: requestedSubdomain,
			localPort: msg.localPort,
			url: "",
			error: "Max tunnels per key exceeded",
		});
		return;
	}

	if (
		!tunnelManager.register(
			requestedSubdomain,
			ws,
			state.id,
			state.keyInfo.keyHash,
			state.keyInfo.userId,
			state.keyInfo.keyId,
			msg.auth,
		)
	) {
		safeSend(ws, {
			type: "register-tunnel-result",
			success: false,
			subdomain: requestedSubdomain,
			localPort: msg.localPort,
			url: "",
			error: "Subdomain already in use",
		});
		return;
	}

	const url = buildTunnelUrl(requestedSubdomain);
	safeSend(ws, {
		type: "register-tunnel-result",
		success: true,
		subdomain: requestedSubdomain,
		localPort: msg.localPort,
		url,
	});
	logger.info(
		{ subdomain: requestedSubdomain, url, localPort: msg.localPort },
		"Additional tunnel registered",
	);
}
