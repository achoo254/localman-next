import { type IdpEndpoints, type TokenSet } from "./idp-client.js";
import type { SessionStore, StoredSession } from "./session-store.js";
/** The session is gone (revoked, expired, logged out): sign in again. */
export declare class SessionExpiredError extends Error {
    /** Tells the reconnect loop to stop instead of retrying. */
    readonly fatal = true;
    constructor(message?: string);
}
/** The session belongs to another Tunelo server than the one dialled. */
export declare class UntrustedServerError extends Error {
    readonly fatal = true;
    constructor(serverUrl: string);
}
export interface SessionDeps {
    discover?: (issuer: string) => Promise<IdpEndpoints>;
    refresh?: (endpoints: IdpEndpoints, refreshToken: string, resource: string) => Promise<TokenSet>;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
}
/** Session built from a fresh token response. */
export declare function sessionFromTokens(issuer: string, tokens: TokenSet, previous: StoredSession | undefined, now: number): StoredSession;
/**
 * Current access token of the session in `store`, refreshed if it is about
 * to expire. The refresh runs under the store's file lock and re-reads the
 * store inside it, so concurrent processes rotate the single-use refresh
 * token exactly once. Throws `SessionExpiredError` when the session is gone.
 */
export declare function getAccessToken(store: SessionStore, deps?: SessionDeps): Promise<string>;
/**
 * `TunnelClientOptions.getApiKey` for the session in `store`: refuses
 * (fatally) to hand its token to a server of another domain than the
 * session's issuer, which could replay it against the real one.
 */
export declare function accountTokenFor(store: SessionStore, serverUrl: string, deps?: SessionDeps): () => Promise<string>;
