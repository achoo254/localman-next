/**
 * Shape checks for the client messages that carry user-controlled fields the
 * server stores or acts on. `parseMessage` only parses JSON; these narrow it.
 */
import type {
	AuthMessage,
	RegisterTunnelMessage,
	TcpRegisterMessage,
} from "@tunelo/shared";

const MAX_KEY_LENGTH = 8192;
const MAX_SUBDOMAIN_INPUT = 63;
const MAX_BASIC_AUTH_LENGTH = 256;
const MAX_DEVICE_ID_LENGTH = 128;
const MAX_DEVICE_NAME_LENGTH = 80;

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
		(msg.tcpOnly === undefined || typeof msg.tcpOnly === "boolean")
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
