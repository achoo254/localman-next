/** Which subdomain an `auth` may open, or why not (with its `TUNELO_*` code). */
import {
	type AuthMessage,
	SUBDOMAIN_REGEX,
	TUNNEL_REFUSAL_CODES,
} from "@tunelo/shared";
import type { KeyInfo } from "./key-store/key-store-types.js";
import {
	isMachineDeviceId,
	isMachineSubdomain,
	machineSubdomain,
} from "./machine-subdomain.js";
import {
	HELD_MESSAGE,
	QUOTA_MESSAGE,
	atMachineLimit,
	atTunnelLimit,
} from "./ws-register-tunnel.js";

export type Refusal = { error: string; code?: string };

/**
 * The subdomain a machine tunnel gets: the one derived from its account and
 * `deviceId`. A client asking for any other name is told it is held.
 */
export function machineTunnel(
	msg: AuthMessage,
	keyInfo: KeyInfo,
): { subdomain: string } | Refusal {
	if (!keyInfo.ownerSub) {
		return {
			error: "Machine tunnels need an account sign-in",
			code: "TUNELO_AUTH_003",
		};
	}
	if (!isMachineDeviceId(msg.deviceId)) {
		return { error: "Machine tunnels need a device id" };
	}
	if (msg.tcpOnly) return { error: "Machine tunnels carry HTTP only" };
	const subdomain = machineSubdomain(keyInfo.ownerSub, msg.deviceId);
	if (msg.subdomain && msg.subdomain !== subdomain) {
		return { error: HELD_MESSAGE, code: TUNNEL_REFUSAL_CODES.SUBDOMAIN_HELD };
	}
	if (atMachineLimit(keyInfo, subdomain)) {
		return { error: QUOTA_MESSAGE, code: TUNNEL_REFUSAL_CODES.QUOTA_EXCEEDED };
	}
	return { subdomain };
}

/** The subdomain a `tunelo http` (or `tcpOnly`) channel asked for, if allowed. */
export function httpTunnel(
	msg: AuthMessage,
	keyInfo: KeyInfo,
	requested: string,
): { subdomain: string } | Refusal {
	if (atTunnelLimit(keyInfo)) {
		return { error: QUOTA_MESSAGE, code: TUNNEL_REFUSAL_CODES.QUOTA_EXCEEDED };
	}
	if (!SUBDOMAIN_REGEX.test(requested)) {
		return { error: "Invalid subdomain format" };
	}
	// `tunelo tcp` asks for no HTTP tunnel: it would be a second, live,
	// public entry pointing at the TCP service.
	if (msg.tcpOnly) return { subdomain: "" };
	if (isMachineSubdomain(requested)) {
		return { error: HELD_MESSAGE, code: TUNNEL_REFUSAL_CODES.SUBDOMAIN_HELD };
	}
	return { subdomain: requested };
}
