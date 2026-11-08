import { randomUUID } from "node:crypto";
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync, } from "node:fs";
import { dirname } from "node:path";
/** A lock whose holder stopped touching it this long ago has crashed. */
const STALE_MS = 30_000;
/** Holders refresh the lock's mtime this often, so it never looks stale. */
const HEARTBEAT_MS = 5_000;
const RETRY_MS = 50;
/** Breaking a stale lock takes microseconds; a breaker this old crashed. */
const BREAKER_STALE_MS = 5_000;
const WAIT_MS = 60_000;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function errorCode(err) {
    return err instanceof Error && "code" in err && typeof err.code === "string"
        ? err.code
        : undefined;
}
function tryAcquire(path, nonce) {
    try {
        writeFileSync(path, nonce, { flag: "wx", mode: 0o600 });
        return true;
    }
    catch (err) {
        if (errorCode(err) !== "EEXIST")
            throw err;
        return false;
    }
}
function isStale(path, maxAgeMs) {
    try {
        return Date.now() - statSync(path).mtimeMs > maxAgeMs;
    }
    catch {
        return false;
    }
}
/**
 * Clears a breaker whose holder crashed. It is moved aside first, which
 * only one waiter can do; a waiter that judged it stale too late may have
 * moved a fresh one, which then goes back.
 *
 * Limits: if the breaker's holder crashed and a fresh breaker was taken in
 * the microseconds between that move and the way back, two waiters may
 * both break; and locks age by mtime, so a holder whose machine slept past
 * `STALE_MS` counts as crashed.
 */
function clearStaleBreaker(breaker, nonce) {
    if (!isStale(breaker, BREAKER_STALE_MS))
        return;
    const moved = `${breaker}.${nonce.replace(/[^\w.-]/g, "_")}`;
    try {
        renameSync(breaker, moved);
    }
    catch {
        return; // Another waiter moved it first.
    }
    if (!isStale(moved, BREAKER_STALE_MS)) {
        try {
            linkSync(moved, breaker);
        }
        catch {
            // A new breaker exists already; its holder goes on.
        }
    }
    rmSync(moved, { force: true });
}
/**
 * Removes the lock at `path` if its holder crashed. Waiters that all saw
 * it stale take turns through a second, short-lived lock (`<path>.break`)
 * and look again inside it: without that, a slow waiter could remove the
 * fresh lock a faster one just took, and both would refresh the token
 * (replay, the grant revoked). Exported for tests.
 */
export function breakStaleLock(path, nonce) {
    const breaker = `${path}.break`;
    clearStaleBreaker(breaker, nonce);
    if (!tryAcquire(breaker, nonce))
        return;
    try {
        if (isStale(path, STALE_MS))
            rmSync(path, { force: true });
    }
    finally {
        release(breaker, nonce);
    }
}
/** Only the holder may remove the lock (its nonce is still in the file). */
function release(path, nonce) {
    try {
        if (readFileSync(path, "utf-8") === nonce)
            rmSync(path);
    }
    catch {
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
export async function withFileLock(path, task) {
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
        }
        catch {
            // Lock removed under us; release() below copes.
        }
    }, HEARTBEAT_MS);
    heartbeat.unref();
    try {
        return await task();
    }
    finally {
        clearInterval(heartbeat);
        release(path, nonce);
    }
}
