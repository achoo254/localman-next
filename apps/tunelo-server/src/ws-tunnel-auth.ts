/** Control-channel `auth`: check the token, then open the first tunnel. */
import {
	type AuthMessage,
	type AuthResult,
	CLIENT_CAPABILITIES,
	TUNNEL_KINDS,
	TUNNEL_REFUSAL_CODES,
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
	IN_USE_MESSAGE,
	generateSubdomain,
	registerOn,
} from "./ws-register-tunnel.js";
import { safeSend } from "./ws-send.js";
import { httpTunnel, machineTunnel } from "./ws-tunnel-grant.js";

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

	const machine = msg.kind === TUNNEL_KINDS.MACHINE;
	const granted = machine
		? machineTunnel(msg, keyInfo)
		: httpTunnel(msg, keyInfo, requested);
	if ("error" in granted) {
		// As before: a quota refusal names no subdomain.
		const quota = granted.code === TUNNEL_REFUSAL_CODES.QUOTA_EXCEEDED;
		refuseAuth(
			ws,
			machine || quota ? "" : requested,
			granted.error,
			WS_CLOSE_CODES.AUTH_FAILED,
			granted.code,
		);
		return;
	}
	const { subdomain } = granted;

	state.wsOpenResult =
		msg.capabilities?.includes(CLIENT_CAPABILITIES.WS_OPEN_RESULT) ?? false;
	const owner = ownerOf(keyInfo, {
		deviceId: msg.deviceId,
		deviceName: cleanDisplayName(msg.deviceName),
	});
	const registered =
		subdomain === "" ||
		registerOn(ws, state.id, keyInfo, owner, {
			subdomain,
			localPort: msg.localPort ?? null,
			auth: msg.auth,
			wsOpenResult: state.wsOpenResult,
			kind: machine ? TUNNEL_KINDS.MACHINE : TUNNEL_KINDS.HTTP,
		});
	if (!registered) {
		refuseAuth(
			ws,
			subdomain,
			IN_USE_MESSAGE,
			WS_CLOSE_CODES.SUBDOMAIN_TAKEN,
			TUNNEL_REFUSAL_CODES.SUBDOMAIN_IN_USE,
		);
		return;
	}

	state.machine = machine;
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
	logger.info(
		{ subdomain, url, kind: keyInfo.kind, machine },
		"Client authenticated",
	);
}
