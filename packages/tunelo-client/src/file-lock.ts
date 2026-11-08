import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readFileSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

/** A lock whose holder stopped touching it this long ago has crashed. */
const STALE_MS = 30_000;
/** Holders refresh the lock's mtime this often, so it never looks stale. */
const HEARTBEAT_MS = 5_000;
const RETRY_MS = 50;
/** Breaking a stale lock takes microseconds; a breaker this old crashed. */
const BREAKER_STALE_MS = 5_000;
const WAIT_MS = 60_000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorCode(err: unknown): string | undefined {
	return err instanceof Error && "code" in err && typeof err.code === "string"
		? err.code
		: undefined;
}

function tryAcquire(path: string, nonce: string): boolean {
	try {
		writeFileSync(path, nonce, { flag: "wx", mode: 0o600 });
		return true;
	} catch (err) {
		if (errorCode(err) !== "EEXIST") throw err;
		return false;
	}
}

function isStale(path: string, maxAgeMs: number): boolean {
	try {
		return Date.now() - statSync(path).mtimeMs > maxAgeMs;
	} catch {
		return false;
	}
}

/**
 * Removes the lock at `path` if its holder crashed. Waiters that all saw
 * it stale take turns through a second, short-lived lock (`<path>.break`)
 * and look again inside it: without that, a slow waiter could remove the
 * fresh lock a faster one just took, and both would refresh the token
 * (replay, the grant revoked). Exported for tests.
 */
export function breakStaleLock(path: string, nonce: string): void {
	const breaker = `${path}.break`;
	if (isStale(breaker, BREAKER_STALE_MS)) rmSync(breaker, { force: true });
	if (!tryAcquire(breaker, nonce)) return;
	try {
		if (isStale(path, STALE_MS)) rmSync(path, { force: true });
	} finally {
		release(breaker, nonce);
	}
}

/** Only the holder may remove the lock (its nonce is still in the file). */
function release(path: string, nonce: string): void {
	try {
		if (readFileSync(path, "utf-8") === nonce) rmSync(path);
	} catch {
		// Already gone.
	}
}

/**
 * Runs `task` while holding an exclusive lock file, across processes.
 * Several processes (`tunelo` commands, agents) may refresh the same rotating refresh token;
 * only one may do it at a time or the IdP revokes the whole grant. The
 * holder keeps the lock fresh while it works, and never removes a lock
 * another process took over.
 */
export async function withFileLock<T>(
	path: string,
	task: () => Promise<T>,
): Promise<T> {
	const nonce = `${process.pid}:${randomUUID()}`;
	// A store whose directory does not exist yet (first sign-in) still locks.
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const deadline = Date.now() + WAIT_MS;
	while (!tryAcquire(path, nonce)) {
		breakStaleLock(path, nonce);
		if (Date.now() > deadline) {
			throw new Error(`Timed out waiting for lock ${path}`);
		}
		await sleep(RETRY_MS);
	}
	const heartbeat = setInterval(() => {
		try {
			const now = new Date();
			utimesSync(path, now, now);
		} catch {
			// Lock removed under us; release() below copes.
		}
	}, HEARTBEAT_MS);
	heartbeat.unref();
	try {
		return await task();
	} finally {
		clearInterval(heartbeat);
		release(path, nonce);
	}
}
