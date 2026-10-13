import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { loadConfig, updateConfig } from "./config.js";
import { getAccessToken } from "./idp-session.js";

/**
 * What `tunelo http|tcp|mcp` authenticates with, in order: `--key`,
 * `TUNELO_KEY`, the account session from `tunelo login`, then an anonymous
 * token saved by an older CLI (works until the server's cutoff date).
 */
export type Credential =
	| { kind: "account"; sub: string; getKey: () => Promise<string> }
	| { kind: "key"; anonymous: boolean; getKey: () => Promise<string> };

/** Servers that may receive the account token: the official deployment
 *  and loopback for local development. Any other host could replay the
 *  token against the real server. */
const ACCOUNT_SERVER_HOSTS = new Set(["tunnel.hoandat.com"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function acceptsAccountToken(serverUrl: string): boolean {
	let url: URL;
	try {
		url = new URL(serverUrl);
	} catch {
		return false;
	}
	if (LOOPBACK_HOSTS.has(url.hostname)) return true;
	const secure = url.protocol === "https:" || url.protocol === "wss:";
	return secure && ACCOUNT_SERVER_HOSTS.has(url.hostname);
}

export const UNTRUSTED_SERVER_MESSAGE =
	"Your account sign-in only works with the official Tunelo server; use --key for this server.";

export function resolveCredential(
	flagKey: string | undefined,
	serverUrl: string,
): Credential | null {
	const explicit = flagKey ?? process.env.TUNELO_KEY;
	if (explicit) {
		return {
			kind: "key",
			anonymous: explicit.startsWith("tunelo_"),
			getKey: async () => explicit,
		};
	}
	const config = loadConfig();
	if (config.session && acceptsAccountToken(serverUrl)) {
		return {
			kind: "account",
			sub: config.session.sub,
			getKey: () => getAccessToken(),
		};
	}
	const saved = config.key;
	if (saved) return { kind: "key", anonymous: true, getKey: async () => saved };
	return null;
}

/** Stable per-machine id; created once and persisted in the config. */
export function getDeviceId(): string {
	const existing = loadConfig().deviceId;
	if (existing) return existing;
	const deviceId = randomUUID();
	updateConfig((config) => ({ ...config, deviceId }));
	return deviceId;
}

/** Machine details sent with `auth` so the account can tell machines apart. */
export function deviceInfo(): { deviceId: string; deviceName: string } {
	return { deviceId: getDeviceId(), deviceName: hostname().slice(0, 80) };
}

export const NO_CREDENTIAL_MESSAGE =
	"Not signed in. Run `tunelo login` (or pass --key / TUNELO_KEY).";
