/**
 * The account session of this machine: a short-lived access token for the
 * tunnel server, refreshed from the stored refresh token before every
 * WebSocket connect and reconnect.
 */
import { join } from "node:path";
import {
	type StoredSession,
	getConfigDir,
	loadConfig,
	updateConfig,
} from "./config.js";
import { withFileLock } from "./file-lock.js";
import {
	type IdpEndpoints,
	OAuthResponseError,
	type TokenSet,
	discover,
	refreshTokens,
	subjectOf,
} from "./idp-client.js";
import { resourceOfIssuer } from "./server-identity.js";

/** Refresh this long before `exp` so a token never expires mid-handshake. */
const EXPIRY_MARGIN_MS = 60_000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

/** The session is gone (revoked, expired, logged out): sign in again. */
export class SessionExpiredError extends Error {
	/** Tells the reconnect loop to stop instead of retrying. */
	readonly fatal = true;
	constructor() {
		super("Your sign-in has expired. Run `tunelo login` again.");
		this.name = "SessionExpiredError";
	}
}

export interface SessionDeps {
	discover?: (issuer: string) => Promise<IdpEndpoints>;
	refresh?: (
		endpoints: IdpEndpoints,
		refreshToken: string,
		resource: string,
	) => Promise<TokenSet>;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
}

function lockPath(): string {
	return join(getConfigDir(), "session.lock");
}

/** Session built from a fresh token response. */
export function sessionFromTokens(
	issuer: string,
	tokens: TokenSet,
	previous: StoredSession | undefined,
	now: number,
): StoredSession {
	const refreshToken = tokens.refreshToken ?? previous?.refreshToken;
	const sub =
		subjectOf(tokens.idToken) ?? subjectOf(tokens.accessToken) ?? previous?.sub;
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

export function saveSession(session: StoredSession): void {
	updateConfig((config) => ({ ...config, session }));
}

export function clearSession(): void {
	updateConfig((config) => ({ ...config, session: undefined }));
}

function stillValid(session: StoredSession, now: number): string | null {
	const { accessToken, accessTokenExpiresAt } = session;
	if (!accessToken || !accessTokenExpiresAt) return null;
	return accessTokenExpiresAt - EXPIRY_MARGIN_MS > now ? accessToken : null;
}

/** Answers meaning the grant is gone; anything else (429, 5xx, network)
 *  is worth another try. */
const DEAD_GRANT_ERRORS = new Set([
	"invalid_grant",
	"invalid_client",
	"unauthorized_client",
]);

function isDeadGrant(err: unknown): boolean {
	return err instanceof OAuthResponseError && DEAD_GRANT_ERRORS.has(err.error);
}

type Attempt = { token: string } | { retry: unknown };

/**
 * One refresh under the lock, re-reading the config inside it: another
 * process may have rotated the token while we waited.
 */
function attemptRefresh(deps: Required<SessionDeps>): Promise<Attempt> {
	return withFileLock(lockPath(), async (): Promise<Attempt> => {
		const session = loadConfig().session;
		if (!session) throw new SessionExpiredError();
		const fresh = stillValid(session, deps.now());
		if (fresh) return { token: fresh };
		let tokens: TokenSet;
		try {
			const endpoints = await deps.discover(session.issuer);
			tokens = await deps.refresh(
				endpoints,
				session.refreshToken,
				resourceOfIssuer(session.issuer),
			);
		} catch (err) {
			if (isDeadGrant(err)) {
				clearSession();
				throw new SessionExpiredError();
			}
			return { retry: err };
		}
		saveSession(sessionFromTokens(session.issuer, tokens, session, deps.now()));
		return { token: tokens.accessToken };
	});
}

/**
 * Current access token, refreshed if it is about to expire. The refresh runs
 * under a file lock and re-reads the config inside it, so concurrent
 * `tunelo` processes rotate the single-use refresh token exactly once.
 */
export async function getAccessToken(deps: SessionDeps = {}): Promise<string> {
	const full: Required<SessionDeps> = {
		discover: deps.discover ?? discover,
		refresh: deps.refresh ?? refreshTokens,
		sleep:
			deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms))),
		now: deps.now ?? Date.now,
	};
	const cached = loadConfig().session;
	if (!cached) throw new SessionExpiredError();
	const ready = stillValid(cached, full.now());
	if (ready) return ready;

	// Back off outside the lock, so other processes are not kept waiting.
	for (let attempt = 0; ; attempt++) {
		const outcome = await attemptRefresh(full);
		if ("token" in outcome) return outcome.token;
		const delay = RETRY_DELAYS_MS[attempt];
		if (delay === undefined) throw outcome.retry;
		await full.sleep(delay);
	}
}
