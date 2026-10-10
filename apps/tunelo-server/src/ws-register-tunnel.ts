/** `register-tunnel`: more tunnels on an authenticated control channel. */
import { type RegisterTunnelMessage, SUBDOMAIN_REGEX } from "@tunelo/shared";
import { customAlphabet } from "nanoid";
import type { WebSocket } from "ws";
import { buildTunnelUrl } from "./config/tunnel-domains.js";
import type { KeyInfo } from "./key-store/key-store-types.js";
import { createLogger } from "./logger.js";
import { tcpPortManager } from "./tcp-port-manager.js";
import { tunnelManager } from "./tunnel-manager.js";
import type { TunnelOwner } from "./tunnel-owner.js";
import type { ConnectionState } from "./ws-connection-state.js";
import { safeSend } from "./ws-send.js";

const logger = createLogger("tunelo-ws-register");

export const generateSubdomain = customAlphabet(
	"abcdefghijklmnopqrstuvwxyz0123456789",
	8,
);

export function registerOn(
	ws: WebSocket,
	connectionId: string,
	keyInfo: KeyInfo,
	owner: TunnelOwner,
	tunnel: { subdomain: string; localPort: number | null; auth?: string },
): boolean {
	return tunnelManager.register({
		...tunnel,
		socket: ws,
		connectionId,
		apiKeyHash: keyInfo.keyHash,
		userId: keyInfo.userId,
		keyId: keyInfo.keyId,
		owner,
	});
}

/** Account tokens share one quota across machines; others count per key. */
export function atTunnelLimit(keyInfo: KeyInfo): boolean {
	const { ownerSub } = keyInfo;
	const open = ownerSub
		? tunnelManager.countByOwner(ownerSub) +
			tcpPortManager.all().filter((t) => t.owner.ownerSub === ownerSub).length
		: tunnelManager.countByKeyHash(keyInfo.keyHash);
	return open >= keyInfo.maxTunnels;
}

/** `tcp-register` within the same quota; refuses and returns false if over. */
export function allowTcpRegister(
	ws: WebSocket,
	keyInfo: KeyInfo,
	localPort: number,
): boolean {
	if (!keyInfo.ownerSub || !atTunnelLimit(keyInfo)) return true;
	safeSend(ws, {
		type: "tcp-register-result",
		success: false,
		localPort,
		remotePort: 0,
		url: "",
		error: "Max tunnels per key exceeded",
	});
	return false;
}

export function handleRegisterTunnel(
	ws: WebSocket,
	state: ConnectionState,
	msg: RegisterTunnelMessage,
): void {
	const { keyInfo, owner } = state;
	if (!state.authenticated || !keyInfo || !owner) return;

	const requested = msg.subdomain || generateSubdomain();
	const refuse = (error: string): void => {
		safeSend(ws, {
			type: "register-tunnel-result",
			success: false,
			subdomain: requested,
			localPort: msg.localPort,
			url: "",
			error,
		});
	};

	if (!SUBDOMAIN_REGEX.test(requested)) {
		refuse("Invalid subdomain format");
		return;
	}
	if (atTunnelLimit(keyInfo)) {
		refuse("Max tunnels per key exceeded");
		return;
	}
	const registered = registerOn(ws, state.id, keyInfo, owner, {
		subdomain: requested,
		localPort: msg.localPort,
		auth: msg.auth,
	});
	if (!registered) {
		refuse("Subdomain already in use");
		return;
	}

	const url = buildTunnelUrl(requested);
	safeSend(ws, {
		type: "register-tunnel-result",
		success: true,
		subdomain: requested,
		localPort: msg.localPort,
		url,
	});
	logger.info(
		{ subdomain: requested, url, localPort: msg.localPort },
		"Additional tunnel registered",
	);
}
