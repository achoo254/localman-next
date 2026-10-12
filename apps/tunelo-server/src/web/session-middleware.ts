import type { Request } from "express";
import type pino from "pino";
import { describeError, oauthErrorCode } from "./oidc-errors.js";
import { readCookie } from "./web-cookies.js";
import type { WebOidcClient } from "./web-oidc-client.js";
import type { WebSession, WebSessionStore } from "./web-session-store.js";

/** Refresh this long before the access token expires. */
export const REFRESH_MARGIN_MS = 60_000;
/**
 * How long past its access token's expiry a session survives refreshes that
 * fail for another reason than `invalid_grant` (IdP down, 5xx, 429, timeout).
 * Beyond it the grant cannot be confirmed any more: signed out.
 */
export const REFRESH_GRACE_MS = 60 * 60 * 1000;

export interface SessionResolverOptions {
	readonly store: WebSessionStore;
	readonly oidc: Pick<WebOidcClient, "refresh">;
	readonly sessionCookie: string;
	readonly logger: pino.Logger;
}

export function needsRefresh(session: WebSession, now = Date.now()): boolean {
	return session.accessExp.getTime() - now < REFRESH_MARGIN_MS;
}

/**
 * Loads the session of a request and keeps its grant checked. Refresh tokens
 * rotate and are single-use, so one session is refreshed by exactly one
 * caller: concurrent requests share one promise (the server runs as a
 * single process). A refresh the IdP refuses with `invalid_grant` (grant
 * revoked at /account, signed out, 90-day cap) ends the session here too.
 */
export class SessionResolver {
	private readonly inFlight = new Map<string, Promise<WebSession | null>>();

	constructor(private readonly options: SessionResolverOptions) {}

	/** The signed-in session of `req`, or `null` (signed out). */
	async resolve(req: Request): Promise<WebSession | null> {
		const cookie = readCookie(req, this.options.sessionCookie);
		if (!cookie) return null;
		const session = await this.options.store.findByCookie(cookie);
		if (!session || !needsRefresh(session)) return session;
		return this.refreshOnce(session.id);
	}

	private refreshOnce(id: string): Promise<WebSession | null> {
		let pending = this.inFlight.get(id);
		if (!pending) {
			pending = this.refresh(id).finally(() => {
				this.inFlight.delete(id);
			});
			this.inFlight.set(id, pending);
		}
		return pending;
	}

	private async refresh(id: string): Promise<WebSession | null> {
		const { store, oidc, logger } = this.options;
		// Re-read under the lock: a refresh that just finished rotated the token.
		const session = await store.findById(id);
		if (!session || !needsRefresh(session)) return session;
		if (!session.refreshToken) {
			await store.deleteById(id);
			return null;
		}
		let tokens: Awaited<ReturnType<WebOidcClient["refresh"]>>;
		try {
			tokens = await oidc.refresh(session.refreshToken);
		} catch (error) {
			if (oauthErrorCode(error) === "invalid_grant") {
				logger.info({ sessionId: id }, "Web session ended at the IdP");
				await store.deleteById(id);
				return null;
			}
			const withinGrace =
				Date.now() - session.accessExp.getTime() < REFRESH_GRACE_MS;
			logger.warn(
				{ sessionId: id, err: describeError(error), withinGrace },
				"Web session refresh failed",
			);
			// Within the grace the next request tries again; beyond it, sign out.
			if (withinGrace) return session;
			await store.deleteById(id);
			return null;
		}
		return store.saveRefreshed(session, {
			refreshToken: tokens.refreshToken ?? session.refreshToken,
			idToken: tokens.idToken ?? session.idToken,
			accessExp: tokens.accessExp,
			refreshExp: tokens.refreshExp,
		});
	}
}
