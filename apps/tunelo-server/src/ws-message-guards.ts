/**
 * Shape checks for the client messages that carry user-controlled fields the
 * server stores or acts on. `parseMessage` only parses JSON; these narrow it.
 */
import {
	type AuthMessage,
	type RegisterTunnelMessage,
	TUNNEL_KINDS,
	type TcpRegisterMessage,
	type WsOpenResultMessage,
} from "@tunelo/shared";

const MAX_KEY_LENGTH = 8192;
const MAX_SUBDOMAIN_INPUT = 63;
const MAX_BASIC_AUTH_LENGTH = 256;
const MAX_DEVICE_ID_LENGTH = 128;
const MAX_DEVICE_NAME_LENGTH = 80;
const MAX_CAPABILITIES = 16;
const MAX_CAPABILITY_LENGTH = 64;
const MAX_WS_ID_LENGTH = 64;
const MAX_PROTOCOL_LENGTH = 256;
/** base64 of `WS_APP_REJECT_BODY_MAX` bytes is ~5.5 KiB; leave headroom. */
const MAX_REFUSAL_BODY_LENGTH = 8192;
const MAX_REFUSAL_HEADERS = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function optionalString(value: unknown, max: number): boolean {
	return (
		value === undefined || (typeof value === "string" && value.length <= max)
	);
}

export function isPort(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isInteger(value) &&
		value >= 1 &&
		value <= 65535
	);
}

function optionalPort(value: unknown): boolean {
	return value === undefined || isPort(value);
}

export function isAuthMessage(msg: unknown): msg is AuthMessage {
	return (
		isRecord(msg) &&
		msg.type === "auth" &&
		typeof msg.key === "string" &&
		msg.key.length > 0 &&
		msg.key.length <= MAX_KEY_LENGTH &&
		// The CLI sends "" to ask for a random subdomain.
		optionalString(msg.subdomain, MAX_SUBDOMAIN_INPUT) &&
		optionalString(msg.auth, MAX_BASIC_AUTH_LENGTH) &&
		optionalPort(msg.localPort) &&
		optionalString(msg.deviceId, MAX_DEVICE_ID_LENGTH) &&
		optionalString(msg.deviceName, MAX_DEVICE_NAME_LENGTH) &&
		(msg.tcpOnly === undefined || typeof msg.tcpOnly === "boolean") &&
		(msg.kind === undefined ||
			msg.kind === TUNNEL_KINDS.HTTP ||
			msg.kind === TUNNEL_KINDS.MACHINE) &&
		(msg.capabilities === undefined || isCapabilityList(msg.capabilities))
	);
}

function isCapabilityList(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length <= MAX_CAPABILITIES &&
		value.every(
			(c) => typeof c === "string" && c.length <= MAX_CAPABILITY_LENGTH,
		)
	);
}

/** Shape only: header names/values and the status are re-checked before
 *  anything reaches the browser (`ws-upgrade-response.ts`). */
function isHeaderRecord(
	value: unknown,
): value is Record<string, string | string[]> {
	if (!isRecord(value) || Array.isArray(value)) return false;
	const entries = Object.values(value);
	return (
		entries.length <= MAX_REFUSAL_HEADERS &&
		entries.every(
			(v) =>
				typeof v === "string" ||
				(Array.isArray(v) && v.every((item) => typeof item === "string")),
		)
	);
}

export function isWsOpenResultMessage(
	msg: unknown,
): msg is WsOpenResultMessage {
	if (
		!isRecord(msg) ||
		msg.type !== "ws-open-result" ||
		typeof msg.id !== "string" ||
		msg.id.length > MAX_WS_ID_LENGTH
	) {
		return false;
	}
	if (msg.ok === true) return optionalString(msg.protocol, MAX_PROTOCOL_LENGTH);
	return (
		msg.ok === false &&
		typeof msg.status === "number" &&
		optionalString(msg.statusText, MAX_PROTOCOL_LENGTH) &&
		(msg.headers === undefined || isHeaderRecord(msg.headers)) &&
		optionalString(msg.body, MAX_REFUSAL_BODY_LENGTH)
	);
}

export function isRegisterTunnelMessage(
	msg: unknown,
): msg is RegisterTunnelMessage {
	return (
		isRecord(msg) &&
		msg.type === "register-tunnel" &&
		optionalString(msg.subdomain, MAX_SUBDOMAIN_INPUT) &&
		isPort(msg.localPort) &&
		optionalString(msg.auth, MAX_BASIC_AUTH_LENGTH)
	);
}

export function isTcpRegisterMessage(msg: unknown): msg is TcpRegisterMessage {
	return (
		isRecord(msg) &&
		msg.type === "tcp-register" &&
		isPort(msg.localPort) &&
		optionalPort(msg.remotePort)
	);
}
