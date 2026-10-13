import { AsyncResource } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import {
	type ClientToServerMessage,
	DEFAULTS,
	WS_CLOSE_CODES,
	parseMessage,
} from "@tunelo/shared";
import type { RawData, WebSocket } from "ws";
import type { TokenAuthenticator } from "./auth/token-authenticator.js";
import { createLogger } from "./logger.js";
import {
	cleanupTcpState,
	createTcpState,
	handleTcpConnectionClose,
	handleTcpData,
	handleTcpRegister,
} from "./tcp-ws-handler.js";
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

/** A control channel, set up in its tenant; its messages run there too. */
export function onControlChannel(
	ws: WebSocket,
	authenticator: TokenAuthenticator,
): void {
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
					tunnelManager.handleStreamFrame(state.id, msg);
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
					wsAppRelay.handleData(state.id, msg);
					break;
				case "ws-close":
					if (!state.authenticated) return;
					wsAppRelay.handleClose(state.id, msg);
					break;
				case "pong":
					break;
				default:
					break;
			}
		}),
	);

	// In the tenant too: in-flight responses failed here record their usage.
	ws.on(
		"close",
		AsyncResource.bind(() => {
			clearTimeout(state.authTimer);
			clearInterval(state.rateLimitInterval);
			if (state.pingInterval) clearInterval(state.pingInterval);
			cleanupTcpState(state.tcpState);
			// Always: a `tcpOnly` channel may still have used `register-tunnel`.
			tunnelManager.unregisterByConnectionId(state.id);
			wsAppRelay.cleanupByConnection(state.id);
		}),
	);

	ws.on("error", (err) => {
		logger.error({ err, subdomain: state.subdomain }, "Socket error");
	});
}
