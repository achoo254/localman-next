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
import { relayedHeaders } from "./local-forward-gate.js";
import { forwardsLocally } from "./local-forward-relay.js";
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
import { wsAppHandshakes } from "./ws-app-handshake.js";
import { wsAppRelay } from "./ws-app-relay.js";
import type { ConnectionState } from "./ws-connection-state.js";
import { onControlChannel } from "./ws-control-channel.js";
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
import { rejectUpgrade } from "./ws-upgrade-response.js";

const logger = createLogger("tunelo-ws");

export interface WsHandlerOptions {
	/** Wait for a client's `ws-open-result` (ms). Overridden only by tests. */
	wsOpenResultTimeoutMs?: number;
}

export function attachWsHandler(
	server: http.Server,
	authenticator: TokenAuthenticator,
	options: WsHandlerOptions = {},
): void {
	const wss = new WebSocketServer({
		noServer: true,
		maxPayload: DEFAULTS.MAX_BODY_SIZE,
	});
	// Subprotocol the local app selected, for upgrades held until it answered.
	const appProtocols = new WeakMap<http.IncomingMessage, string | null>();
	// Browser→app WebSocket relay. A held upgrade answers with the app's own
	// choice; an older client's is answered before the app is asked, so it
	// echoes the first requested subprotocol (socket.io and the like need one).
	const appWss = new WebSocketServer({
		noServer: true,
		maxPayload: DEFAULTS.MAX_BODY_SIZE,
		handleProtocols: (protocols, request) => {
			const chosen = appProtocols.get(request);
			if (chosen === undefined) return protocols.values().next().value ?? false;
			return chosen !== null && protocols.has(chosen) ? chosen : false;
		},
	});

	// The tenant of each control channel, from its upgrade request's Host.
	const tenants = new WeakMap<http.IncomingMessage, TunnelTenant>();

	server.on("upgrade", (req, socket, head) => {
		// Node drops its own socket error handler before "upgrade": a reset
		// while the tenant lookup is pending would crash the process.
		const dropError = (): void => undefined;
		socket.on("error", dropError);
		void tenantDirectory()
			.byHost(req.headers.host ?? "")
			.then(
				(tenant) => ({ tenant, failed: false }),
				() => ({ tenant: undefined, failed: true }),
			)
			.then(({ tenant, failed }) => {
				socket.off("error", dropError);
				if (socket.destroyed) return;
				if (failed) {
					rejectUpgrade(
						socket,
						"503 Service Unavailable",
						"Tenant unavailable",
					);
					return;
				}
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

		// Local forwards are plain HTTP: no WebSocket under that path.
		if (subdomain && forwardsLocally(subdomain, url.pathname)) {
			rejectUpgrade(socket, "404 Not Found", "Not found");
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
			const path = url.pathname + url.search;
			const headers = relayedHeaders(
				subdomain,
				req.headers as Record<string, string | string[]>,
			);
			const protocol = Array.isArray(proto) ? proto.join(", ") : proto;
			if (tunnelManager.get(subdomain)?.wsOpenResult) {
				wsAppHandshakes.begin({
					socket,
					head,
					subdomain,
					path,
					headers,
					protocol,
					timeoutMs: options.wsOpenResultTimeoutMs,
					accept: (fullHead, chosen, onOpen) => {
						appProtocols.set(req, chosen ?? null);
						appWss.handleUpgrade(req, socket, fullHead, onOpen);
					},
				});
				return;
			}
			appWss.handleUpgrade(req, socket, head, (browserWs) => {
				wsAppRelay.register(browserWs, subdomain, path, headers, protocol);
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
		runInTenant(tenant, () => onControlChannel(ws, authenticator));
	});
}
