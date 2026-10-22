import type { Router } from "express";
import { asyncHandler } from "../../http/async-handler.js";
import { readCookie } from "../../http/cookies.js";
import { noStore } from "../../http/no-store.js";
import type { Logger } from "../../logger.js";
import { AUTH_PATHS } from "../../operations/protocol-routes.js";
import { type AuthCookies, clearCookie } from "./auth-cookies.js";
import type { OidcApi } from "./oidc-api.js";
import { IdpUnavailableError } from "./oidc-errors.js";
import type { SessionStore } from "./session-store.js";

export interface LogoutRouteOptions {
	readonly oidc: OidcApi;
	readonly sessions: SessionStore;
	readonly cookies: AuthCookies;
	readonly logger: Logger;
}

/** `POST /auth/logout`: the browser session, then RP-initiated logout. */
export function registerLogout(
	router: Router,
	{ oidc, sessions, cookies, logger }: LogoutRouteOptions,
): void {
	router.post(
		AUTH_PATHS.logout,
		noStore,
		asyncHandler(async (req, res) => {
			const raw = readCookie(req, cookies.session.name);
			const session = raw ? await sessions.findByCookie(raw) : null;
			if (session) await sessions.destroyById(session.id);
			clearCookie(res, cookies.session);
			// Signed out on purpose: no silent sign-in on the next visit.
			clearCookie(res, cookies.ssoHint);
			let target = "/";
			try {
				const url = await oidc.endSessionUrl(session?.tokens.idToken);
				if (url) target = url.href;
			} catch (error) {
				if (!(error instanceof IdpUnavailableError)) throw error;
				logger.warn("IdP unavailable during logout; local session ended");
			}
			res.redirect(303, target);
		}),
	);
}
