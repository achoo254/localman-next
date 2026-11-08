/** `register-tunnel`: more tunnels on an authenticated control channel. */
import {
	type RegisterTunnelMessage,
	SUBDOMAIN_REGEX,
	TUNNEL_REFUSAL_CODES,
	type TunnelKind,
} from "@tunelo/shared";
import { customAlphabet } from "nanoid";
import type { WebSocket } from "ws";
import { buildTunnelUrl } from "./config/tunnel-domains.js";
import type { KeyInfo } from "./key-store/key-store-types.js";
import { createLogger } from "./logger.js";
import { isMachineSubdomain } from "./machine-subdomain.js";
import { tcpPortManager } from "./tcp-port-manager.js";
import { currentTenantId } from "./tenancy/tunnel-tenant.js";
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
	tunnel: {
		subdomain: string;
		localPort: number | null;
		auth?: string;
		wsOpenResult: boolean;
		kind?: TunnelKind;
	},
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
			tcpPortManager
				.all()
				.filter(
					(t) =>
						t.owner.ownerSub === ownerSub && t.tenantId === currentTenantId(),
				).length
		: tunnelManager.countByKeyHash(keyInfo.keyHash);
	return open >= keyInfo.maxTunnels;
}

/** Machine tunnels count apart, per account; `subdomain` is the one being
 *  (re)opened, so a machine replacing its stale self never counts twice. */
export function atMachineLimit(keyInfo: KeyInfo, subdomain: string): boolean {
	const { ownerSub } = keyInfo;
	if (!ownerSub) return true;
	return (
		tunnelManager.countMachinesByOwner(ownerSub, subdomain) >=
		(keyInfo.maxMachineTunnels ?? 0)
	);
}

export const QUOTA_MESSAGE = "Max tunnels per key exceeded";
export const HELD_MESSAGE = "Subdomain is held for another machine";
export const IN_USE_MESSAGE = "Subdomain already in use";

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
		error: QUOTA_MESSAGE,
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
	const refuse = (error: string, code?: string): void => {
		safeSend(ws, {
			type: "register-tunnel-result",
			success: false,
			subdomain: requested,
			localPort: msg.localPort,
			url: "",
			error,
			...(code ? { code } : {}),
		});
	};
	// A machine channel carries its one tunnel only.
	if (state.machine) {
		refuse("A machine connection carries a single tunnel");
		return;
	}

	if (!SUBDOMAIN_REGEX.test(requested)) {
		refuse("Invalid subdomain format");
		return;
	}
	if (isMachineSubdomain(requested)) {
		refuse(HELD_MESSAGE, TUNNEL_REFUSAL_CODES.SUBDOMAIN_HELD);
		return;
	}
	if (atTunnelLimit(keyInfo)) {
		refuse(QUOTA_MESSAGE, TUNNEL_REFUSAL_CODES.QUOTA_EXCEEDED);
		return;
	}
	const registered = registerOn(ws, state.id, keyInfo, owner, {
		subdomain: requested,
		localPort: msg.localPort,
		auth: msg.auth,
		wsOpenResult: state.wsOpenResult,
	});
	if (!registered) {
		refuse(IN_USE_MESSAGE, TUNNEL_REFUSAL_CODES.SUBDOMAIN_IN_USE);
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
