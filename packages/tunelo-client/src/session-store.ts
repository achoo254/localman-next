/**
 * Where an account session lives. The library never picks a location: the
 * caller names the file (`fileSessionStore`) or supplies its own store (the
 * `tunelo` CLI keeps the session inside `~/.tunelo/config.json`).
 */
import {
	chmodSync,
	closeSync,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

/** Account sign-in made with the OAuth device flow at the IdP. */
export interface StoredSession {
	issuer: string;
	/** Account id (`sub`). */
	sub: string;
	/** Rotating, single-use; replaced on every refresh. */
	refreshToken: string;
	accessToken?: string | undefined;
	/** Epoch ms. */
	accessTokenExpiresAt?: number | undefined;
}

export interface SessionStore {
	/** The stored session; undefined when none (or unreadable). */
	load(): StoredSession | undefined;
	save(session: StoredSession): void;
	clear(): void;
	/** Lock file serialising refreshes across processes sharing the store. */
	readonly lockPath: string;
}

/** Owner-only: the file holds a refresh token. */
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** A session read from untrusted JSON; undefined unless it is complete. */
export function parseSession(value: unknown): StoredSession | undefined {
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

/**
 * Writes `content` atomically (temp file + rename, so a concurrent reader
 * never sees half a file) with owner-only permissions, and durably: the
 * file's data is flushed before the rename and the rename itself after it.
 * A rotated refresh token that the IdP has issued but a crash or power loss
 * then drops cannot be recovered (presenting the old one revokes the grant),
 * so the write must not stay only in the page cache.
 */
export function writePrivateFile(path: string, content: string): void {
	const dir = dirname(path);
	mkdirSync(dir, { recursive: true, mode: DIR_MODE });
	const temp = `${path}.${process.pid}.tmp`;
	const fd = openSync(temp, "w", FILE_MODE);
	try {
		writeFileSync(fd, content);
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
	// `mode` only applies when the file is created; enforce it either way.
	chmodSync(temp, FILE_MODE);
	renameSync(temp, path);
	syncDirectory(dir);
}

/**
 * Flushes a directory entry so a rename survives a crash. Skipped on Windows,
 * which cannot open a directory for this.
 */
function syncDirectory(dir: string): void {
	if (process.platform === "win32") return;
	const fd = openSync(dir, "r");
	try {
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
}

/**
 * A session kept alone in the JSON file at `path` (owner-only), with the
 * refresh lock beside it at `<path>.lock`.
 */
export function fileSessionStore(path: string): SessionStore {
	return {
		lockPath: `${path}.lock`,
		load() {
			try {
				return parseSession(JSON.parse(readFileSync(path, "utf-8")));
			} catch {
				return undefined;
			}
		},
		save(session) {
			writePrivateFile(path, `${JSON.stringify(session, null, 2)}\n`);
		},
		clear() {
			rmSync(path, { force: true });
		},
	};
}
