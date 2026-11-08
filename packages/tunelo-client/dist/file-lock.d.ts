/**
 * Runs `task` while holding an exclusive lock file, across processes.
 * Several processes (`tunelo` commands, agents) may refresh the same rotating refresh token;
 * only one may do it at a time or the IdP revokes the whole grant. The
 * holder keeps the lock fresh while it works, and never removes a lock
 * another process took over.
 */
export declare function withFileLock<T>(path: string, task: () => Promise<T>): Promise<T>;
