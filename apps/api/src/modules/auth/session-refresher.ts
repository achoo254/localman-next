import { setTimeout as sleep } from "node:timers/promises";
import type { Logger } from "../../logger.js";
import type { OidcApi } from "./oidc-api.js";
import { authUnavailableError, oauthErrorCode } from "./oidc-errors.js";
import type { Session } from "./session-model.js";
import type { SessionStore } from "./session-store.js";

/** Refresh this long before the access token expires. */
export const REFRESH_MARGIN_MS = 60_000;
/** Longer than one token request (timeout included) so a lease never overlaps. */
const LEASE_MS = 30_000;
const WAIT_STEP_MS = 150;

export interface SessionRefresherOptions {
	readonly store: SessionStore;
	readonly oidc: OidcApi;
	readonly logger: Logger;
	/** Runs after a successful refresh (re-reads userinfo); errors are logged. */
	readonly afterRefresh?: (session: Session) => Promise<void>;
}

export function needsRefresh(session: Session, now = Date.now()): boolean {
	return session.accessTokenExpiresAt.getTime() - now < REFRESH_MARGIN_MS;
}

/**
 * Keeps a session's access token fresh without the user noticing.
 * Refresh tokens rotate and a replayed one revokes the whole grant, so a
 * session is refreshed by exactly one caller: requests in this process
 * share one promise, and processes coordinate through a lease on the
 * session document. Waiters re-read the session once the holder is done.
 */
export class SessionRefresher {
	private readonly inFlight = new Map<string, Promise<Session | null>>();

	constructor(private readonly options: SessionRefresherOptions) {}

	/** The session with a usable access token, or `null` when it has ended. */
	async ensureFresh(session: Session): Promise<Session | null> {
		if (!needsRefresh(session)) return session;
		let pending = this.inFlight.get(session.id);
		if (!pending) {
			pending = this.refresh(session.id).finally(() => {
				this.inFlight.delete(session.id);
			});
			this.inFlight.set(session.id, pending);
		}
		return pending;
	}

	private async refresh(id: string): Promise<Session | null> {
		const { store } = this.options;
		const deadline = Date.now() + LEASE_MS;
		for (;;) {
			const current = await store.findById(id);
			if (!current || !needsRefresh(current)) return current;
			if (await store.acquireRefreshLease(id, LEASE_MS)) {
				// Another process may have finished between the read and the lease.
				const latest = await store.findById(id);
				if (!latest || !needsRefresh(latest)) {
					await store.releaseRefreshLease(id);
					return latest;
				}
				return this.refreshHoldingLease(latest);
			}
			if (Date.now() > deadline) throw authUnavailableError();
			await sleep(WAIT_STEP_MS);
		}
	}

	private async refreshHoldingLease(session: Session): Promise<Session | null> {
		const { store, oidc, logger } = this.options;
		const refreshToken = session.tokens.refreshToken;
		if (!refreshToken) {
			await store.destroyById(session.id);
			return null;
		}
		let refreshed: Awaited<ReturnType<OidcApi["refresh"]>>;
		try {
			refreshed = await oidc.refresh(refreshToken);
		} catch (error) {
			if (oauthErrorCode(error) === "invalid_grant") {
				// The IdP session ended (logout, revocation, 30/90-day limit).
				logger.info({ sessionId: session.id }, "Session ended at the IdP");
				await store.destroyById(session.id);
				return null;
			}
			await store.releaseRefreshLease(session.id);
			logger.warn(
				{ sessionId: session.id, code: oauthErrorCode(error) },
				"Token refresh failed",
			);
			if (session.accessTokenExpiresAt.getTime() > Date.now()) return session;
			throw authUnavailableError();
		}
		const saved = await store.saveRefreshed(
			session.id,
			{
				accessToken: refreshed.accessToken,
				refreshToken: refreshed.refreshToken ?? refreshToken,
				idToken: refreshed.idToken ?? session.tokens.idToken,
			},
			refreshed.accessTokenExpiresAt,
		);
		if (saved && this.options.afterRefresh) {
			await this.options.afterRefresh(saved).catch((error: unknown) => {
				logger.warn(
					{ sessionId: saved.id, err: error },
					"Post-refresh profile sync failed",
				);
			});
		}
		return saved;
	}
}
