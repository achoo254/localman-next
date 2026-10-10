/** Control-channel `auth`: check the token, then open the first tunnel. */
import {
	type AuthMessage,
	type AuthResult,
	SUBDOMAIN_REGEX,
	TUNNEL_SCOPES,
	WS_CLOSE_CODES,
} from "@tunelo/shared";
import { WebSocket } from "ws";
import type { TokenAuthenticator } from "./auth/token-authenticator.js";
import { buildTunnelUrl } from "./config/tunnel-domains.js";
import { cleanDisplayName } from "./lib/display-name.js";
import { createLogger } from "./logger.js";
import { ownerOf } from "./tunnel-owner.js";
import type { ConnectionState } from "./ws-connection-state.js";
import {
	atTunnelLimit,
	generateSubdomain,
	registerOn,
} from "./ws-register-tunnel.js";
import { safeSend } from "./ws-send.js";

const logger = createLogger("tunelo-ws-auth");

/** RFC 6455 "Try Again Later": verification could not run, retry. */
const TRY_AGAIN_LATER = 1013;
const INTERNAL_ERROR = 1011;

function refuseAuth(
	ws: WebSocket,
	subdomain: string,
	error: string,
	closeCode: number,
	code?: string,
): void {
	const result: AuthResult = {
		type: "auth-result",
		success: false,
		subdomain,
		url: "",
		error,
		...(code ? { code } : {}),
	};
	safeSend(ws, result);
	ws.close(closeCode, error.slice(0, 120));
}

export async function handleAuth(
	ws: WebSocket,
	state: ConnectionState,
	msg: AuthMessage,
	authenticator: TokenAuthenticator,
): Promise<void> {
	if (state.authStarted) return;
	state.authStarted = true;
	clearTimeout(state.authTimer);
	const requested = msg.subdomain || generateSubdomain();

	let outcome: Awaited<ReturnType<TokenAuthenticator["authenticate"]>>;
	try {
		outcome = await authenticator.authenticate(msg.key, TUNNEL_SCOPES.OPEN);
	} catch (err) {
		logger.error({ err, connectionId: state.id }, "Token check failed");
		refuseAuth(ws, requested, "Internal error", INTERNAL_ERROR);
		return;
	}
	// The socket may have gone while the token was checked; registering now
	// would leave a tunnel no close handler will ever remove.
	if (ws.readyState !== WebSocket.OPEN) return;

	if (!outcome.ok) {
		const closeCode = outcome.retryable
			? TRY_AGAIN_LATER
			: WS_CLOSE_CODES.AUTH_FAILED;
		refuseAuth(ws, requested, outcome.message, closeCode, outcome.code);
		return;
	}
	const { keyInfo } = outcome;

	if (atTunnelLimit(keyInfo)) {
		refuseAuth(
			ws,
			"",
			"Max tunnels per key exceeded",
			WS_CLOSE_CODES.AUTH_FAILED,
		);
		return;
	}
	if (!SUBDOMAIN_REGEX.test(requested)) {
		refuseAuth(
			ws,
			requested,
			"Invalid subdomain format",
			WS_CLOSE_CODES.AUTH_FAILED,
		);
		return;
	}

	const owner = ownerOf(keyInfo, {
		deviceId: msg.deviceId,
		deviceName: cleanDisplayName(msg.deviceName),
	});
	// `tunelo tcp` asks for no HTTP tunnel: it would be a second, live,
	// public entry pointing at the TCP service.
	const subdomain = msg.tcpOnly ? "" : requested;
	const registered =
		msg.tcpOnly ||
		registerOn(ws, state.id, keyInfo, owner, {
			subdomain,
			localPort: msg.localPort ?? null,
			auth: msg.auth,
		});
	if (!registered) {
		refuseAuth(
			ws,
			requested,
			"Subdomain already in use",
			WS_CLOSE_CODES.SUBDOMAIN_TAKEN,
		);
		return;
	}

	state.authenticated = true;
	state.subdomain = subdomain;
	state.keyInfo = keyInfo;
	state.owner = owner;
	const url = subdomain ? buildTunnelUrl(subdomain) : "";
	const cutoff =
		keyInfo.kind === "legacy" ? authenticator.legacyCutoffIso() : undefined;

	safeSend(ws, {
		type: "auth-result",
		success: true,
		subdomain,
		url,
		...(cutoff ? { legacyTokenCutoff: cutoff } : {}),
	});
	logger.info({ subdomain, url, kind: keyInfo.kind }, "Client authenticated");
}
