/**
 * An account session: a short-lived access token for the tunnel server,
 * refreshed from the stored refresh token before every WebSocket connect
 * and reconnect.
 */
import { withFileLock } from "./file-lock.js";
import { OAuthResponseError, discover, refreshTokens, subjectOf, } from "./idp-client.js";
import { acceptsAccountToken, resourceOfIssuer } from "./server-identity.js";
/** Refresh this long before `exp` so a token never expires mid-handshake. */
const EXPIRY_MARGIN_MS = 60_000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
/** The session is gone (revoked, expired, logged out): sign in again. */
export class SessionExpiredError extends Error {
    /** Tells the reconnect loop to stop instead of retrying. */
    fatal = true;
    constructor(message = "The sign-in has expired. Sign in again.") {
        super(message);
        this.name = "SessionExpiredError";
    }
}
/** The session belongs to another Tunelo server than the one dialled. */
export class UntrustedServerError extends Error {
    fatal = true;
    constructor(serverUrl) {
        super(`The sign-in is not for the Tunelo server ${serverUrl}.`);
        this.name = "UntrustedServerError";
    }
}
/** Session built from a fresh token response. */
export function sessionFromTokens(issuer, tokens, previous, now) {
    const refreshToken = tokens.refreshToken ?? previous?.refreshToken;
    const sub = subjectOf(tokens.idToken) ?? subjectOf(tokens.accessToken) ?? previous?.sub;
    if (!refreshToken || !sub) {
        throw new Error("The identity provider returned no refresh token");
    }
    return {
        issuer,
        sub,
        refreshToken,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: now + tokens.expiresIn * 1000,
    };
}
function stillValid(session, now) {
    const { accessToken, accessTokenExpiresAt } = session;
    if (!accessToken || !accessTokenExpiresAt)
        return null;
    return accessTokenExpiresAt - EXPIRY_MARGIN_MS > now ? accessToken : null;
}
/** Answers meaning the grant is gone; anything else (429, 5xx, network)
 *  is worth another try. */
const DEAD_GRANT_ERRORS = new Set([
    "invalid_grant",
    "invalid_client",
    "unauthorized_client",
]);
function isDeadGrant(err) {
    return err instanceof OAuthResponseError && DEAD_GRANT_ERRORS.has(err.error);
}
/**
 * One refresh under the lock, re-reading the store inside it: another
 * process may have rotated the token while we waited. The new session is
 * saved before its token is handed out.
 */
function attemptRefresh(store, deps) {
    return withFileLock(store.lockPath, async () => {
        const session = store.load();
        if (!session)
            throw new SessionExpiredError();
        const fresh = stillValid(session, deps.now());
        if (fresh)
            return { token: fresh };
        let tokens;
        try {
            const endpoints = await deps.discover(session.issuer);
            tokens = await deps.refresh(endpoints, session.refreshToken, resourceOfIssuer(session.issuer));
        }
        catch (err) {
            if (isDeadGrant(err)) {
                store.clear();
                throw new SessionExpiredError();
            }
            return { retry: err };
        }
        store.save(sessionFromTokens(session.issuer, tokens, session, deps.now()));
        return { token: tokens.accessToken };
    });
}
/**
 * Current access token of the session in `store`, refreshed if it is about
 * to expire. The refresh runs under the store's file lock and re-reads the
 * store inside it, so concurrent processes rotate the single-use refresh
 * token exactly once. Throws `SessionExpiredError` when the session is gone.
 */
export async function getAccessToken(store, deps = {}) {
    const full = {
        discover: deps.discover ?? discover,
        refresh: deps.refresh ?? refreshTokens,
        sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
        now: deps.now ?? Date.now,
    };
    const cached = store.load();
    if (!cached)
        throw new SessionExpiredError();
    const ready = stillValid(cached, full.now());
    if (ready)
        return ready;
    // Back off outside the lock, so other processes are not kept waiting.
    for (let attempt = 0;; attempt++) {
        const outcome = await attemptRefresh(store, full);
        if ("token" in outcome)
            return outcome.token;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined)
            throw outcome.retry;
        await full.sleep(delay);
    }
}
/**
 * `TunnelClientOptions.getApiKey` for the session in `store`: refuses
 * (fatally) to hand its token to a server of another domain than the
 * session's issuer, which could replay it against the real one.
 */
export function accountTokenFor(store, serverUrl, deps = {}) {
    return async () => {
        const session = store.load();
        if (!session)
            throw new SessionExpiredError();
        if (!acceptsAccountToken(serverUrl, session.issuer)) {
            throw new UntrustedServerError(serverUrl);
        }
        return getAccessToken(store, deps);
    };
}
