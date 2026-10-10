import {
	chmodSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Account sign-in from `tunelo login` (OAuth device flow at the IdP). */
export interface StoredSession {
	issuer: string;
	/** Account id (`sub`). */
	sub: string;
	/** Rotating, single-use; replaced on every refresh. */
	refreshToken: string;
	accessToken?: string;
	/** Epoch ms. */
	accessTokenExpiresAt?: number;
}

export interface TuneloConfig {
	server?: string;
	/** Anonymous access token (`tunelo_…`) of CLI 1.6.x or `--legacy-key`. */
	key?: string;
	/** Stable per-machine id used for idempotent device login. */
	deviceId?: string;
	session?: StoredSession;
}

/** Owner-only: the file holds a refresh token. */
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

export function getConfigDir(): string {
	return join(homedir(), ".tunelo");
}

export function getConfigPath(): string {
	return join(getConfigDir(), "config.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseSession(value: unknown): StoredSession | undefined {
	if (!isRecord(value)) return undefined;
	const issuer = optionalString(value.issuer);
	const sub = optionalString(value.sub);
	const refreshToken = optionalString(value.refreshToken);
	if (!issuer || !sub || !refreshToken) return undefined;
	const expiresAt = value.accessTokenExpiresAt;
	return {
		issuer,
		sub,
		refreshToken,
		accessToken: optionalString(value.accessToken),
		accessTokenExpiresAt: typeof expiresAt === "number" ? expiresAt : undefined,
	};
}

/** Reads the config; a missing or corrupt file reads as empty. */
export function loadConfig(): TuneloConfig {
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(getConfigPath(), "utf-8"));
	} catch {
		return {};
	}
	if (!isRecord(raw)) return {};
	return {
		server: optionalString(raw.server),
		key: optionalString(raw.key),
		deviceId: optionalString(raw.deviceId),
		session: parseSession(raw.session),
	};
}

/**
 * Writes the config atomically (temp file + rename, so a concurrent reader
 * never sees half a file) with owner-only permissions.
 */
export function saveConfig(config: TuneloConfig): void {
	const dir = getConfigDir();
	mkdirSync(dir, { recursive: true, mode: DIR_MODE });
	const path = getConfigPath();
	const temp = `${path}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify(config, null, 2)}\n`, {
		mode: FILE_MODE,
	});
	// `mode` only applies when the file is created; enforce it either way.
	chmodSync(temp, FILE_MODE);
	renameSync(temp, path);
}

/** Read-modify-write helper. */
export function updateConfig(
	change: (config: TuneloConfig) => TuneloConfig,
): TuneloConfig {
	const next = change(loadConfig());
	saveConfig(next);
	return next;
}
