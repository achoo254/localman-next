/**
 * Removes the lock at `path` if its holder crashed. Waiters that all saw
 * it stale take turns through a second, short-lived lock (`<path>.break`)
 * and look again inside it: without that, a slow waiter could remove the
 * fresh lock a faster one just took, and both would refresh the token
 * (replay, the grant revoked). Exported for tests.
 */
export declare function breakStaleLock(path: string, nonce: string): void;
/**
 * Runs `task` while holding an exclusive lock file, across processes.
 * Several processes (`tunelo` commands, agents) may refresh the same rotating refresh token;
 * only one may do it at a time or the IdP revokes the whole grant. The
 * holder keeps the lock fresh while it works, and never removes a lock
 * another process took over.
 */
export declare function withFileLock<T>(path: string, task: () => Promise<T>): Promise<T>;
