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
/** A session read from untrusted JSON; undefined unless it is complete. */
export declare function parseSession(value: unknown): StoredSession | undefined;
/**
 * Writes `content` atomically (temp file + rename, so a concurrent reader
 * never sees half a file) with owner-only permissions.
 */
export declare function writePrivateFile(path: string, content: string): void;
/**
 * A session kept alone in the JSON file at `path` (owner-only), with the
 * refresh lock beside it at `<path>.lock`.
 */
export declare function fileSessionStore(path: string): SessionStore;
