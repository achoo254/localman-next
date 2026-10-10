import { randomUUID } from "node:crypto";
import {
	readFileSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";

/** A lock whose holder stopped touching it this long ago has crashed. */
const STALE_MS = 30_000;
/** Holders refresh the lock's mtime this often, so it never looks stale. */
const HEARTBEAT_MS = 5_000;
const RETRY_MS = 50;
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

function removeIfStale(path: string): void {
	try {
		if (Date.now() - statSync(path).mtimeMs > STALE_MS) rmSync(path);
	} catch {
		// Gone already: the next attempt will take it.
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
 * Several `tunelo` processes may refresh the same rotating refresh token;
 * only one may do it at a time or the IdP revokes the whole grant. The
 * holder keeps the lock fresh while it works, and never removes a lock
 * another process took over.
 */
export async function withFileLock<T>(
	path: string,
	task: () => Promise<T>,
): Promise<T> {
	const nonce = `${process.pid}:${randomUUID()}`;
	const deadline = Date.now() + WAIT_MS;
	while (!tryAcquire(path, nonce)) {
		removeIfStale(path);
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
