import { Router } from "express";
import * as oidcLib from "openid-client";
import { asyncHandler } from "../../http/async-handler.js";
import { readCookie } from "../../http/cookies.js";
import { noStore } from "../../http/no-store.js";
import type { Logger } from "../../logger.js";
import { AUTH_PATHS } from "../../operations/protocol-routes.js";
import { syncUserFromUserInfo } from "../users/user-sync.js";
import type { MobileAppSettings } from "./app-link-association.js";
import { type AuthCookies, clearCookie } from "./auth-cookies.js";
import {
	loginRateLimit,
	redirectAfterFailedSignIn,
	redirectWithError,
} from "./auth-redirects.js";
import { registerBackchannelLogout } from "./backchannel-logout-route.js";
import { refusedAsDeleted } from "./deleted-account-sign-in.js";
import { registerLogin } from "./login-route.js";
import { consumeLoginTransaction } from "./login-transaction.js";
import { registerLogout } from "./logout-route.js";
import type { MobileHandoffStore } from "./mobile-handoff-model.js";
import {
	registerMobileHandoff,
	startMobileHandoff,
} from "./mobile-handoff-routes.js";
import type { OidcApi } from "./oidc-api.js";
import { IdpUnavailableError } from "./oidc-errors.js";
import type { SessionStore } from "./session-store.js";

export interface AuthRoutesOptions {
	readonly oidc: OidcApi;
	readonly sessions: SessionStore;
	readonly cookies: AuthCookies;
	readonly logger: Logger;
	readonly handoffs: MobileHandoffStore;
	/** Native apps that may sign in; none: the mobile sign-in is off. */
	readonly mobile?: MobileAppSettings;
	/** `/auth/login` and `/auth/callback` per client IP and minute (default 20 each). */
	readonly loginLimitPerMinute?: number;
	/** `POST /auth/backchannel-logout` per client IP and minute. */
	readonly serverLimitPerMinute?: number;
}

/**
 * OpenID Connect endpoints for browsers (`/auth/*`). They are protocol
 * routes, not operations: see operations/protocol-routes.ts.
 */
export function createAuthRouter(options: AuthRoutesOptions): Router {
	const { oidc, sessions, cookies, logger, handoffs } = options;
	const router = Router();
	const loginLimit = options.loginLimitPerMinute ?? 20;

	registerLogin(router, {
		oidc,
		cookies,
		logger,
		mobile: options.mobile,
		limitPerMinute: loginLimit,
	});

	router.get(
		AUTH_PATHS.callback,
		noStore,
		loginRateLimit(loginLimit),
		asyncHandler(async (req, res) => {
			const transaction = await consumeLoginTransaction(
				readCookie(req, cookies.login.name),
				req.query.state,
			);
			if (!transaction) {
				// The cookie is kept: a forged callback must not cancel the
				// sign-in this browser really has in progress.
				redirectWithError(res, "login_expired");
				return;
			}
			clearCookie(res, cookies.login);
			let tokens: Awaited<ReturnType<OidcApi["exchangeCode"]>>;
			try {
				tokens = await oidc.exchangeCode(
					// The tenant client's own redirect URI gives the origin.
					new URL(req.originalUrl, oidc.redirectUri),
					transaction,
				);
			} catch (error) {
				if (error instanceof oidcLib.AuthorizationResponseError) {
					// Includes `login_required` and the like for a silent sign-in.
					redirectAfterFailedSignIn(
						res,
						transaction,
						error.error === "access_denied" ? "access_denied" : "login_failed",
					);
					return;
				}
				if (error instanceof IdpUnavailableError) {
					redirectAfterFailedSignIn(res, transaction, "idp_unavailable");
					return;
				}
				logger.warn({ err: error }, "Authorization code exchange failed");
				redirectAfterFailedSignIn(res, transaction, "login_failed");
				return;
			}
			const sub = tokens.claims?.sub;
			if (!sub) throw new Error("ID token has no subject");
			const sid = tokens.claims?.sid;
			if (await refusedAsDeleted(res, cookies, sub, transaction)) return;
			let account: string;
			try {
				const info = await oidc.userInfo(tokens.accessToken, sub);
				await syncUserFromUserInfo(info, sub);
				account = info.email ?? info.preferred_username ?? info.name ?? sub;
			} catch (error) {
				logger.warn({ err: error }, "Userinfo at sign-in failed");
				redirectAfterFailedSignIn(res, transaction, "login_failed");
				return;
			}
			const signedIn = {
				sub,
				sid: typeof sid === "string" ? sid : undefined,
				tokens: {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					idToken: tokens.idToken,
				},
				accessTokenExpiresAt: tokens.accessTokenExpiresAt,
			};
			// The app's sign-in leaves this browser's web session alone.
			if (transaction.mobile) {
				await startMobileHandoff(res, handoffs, transaction.mobile, {
					...signedIn,
					account,
				});
				return;
			}

			// A fresh session id at every sign-in (no session fixation).
			const previous = readCookie(req, cookies.session.name);
			const previousSession = previous
				? await sessions.findByCookie(previous)
				: null;
			if (previousSession) await sessions.destroyById(previousSession.id);
			const { cookieValue } = await sessions.create(signedIn);
			res.cookie(cookies.session.name, cookieValue, cookies.session.options);
			res.cookie(cookies.ssoHint.name, "1", cookies.ssoHint.options);
			res.redirect(303, transaction.returnTo);
		}),
	);

	registerLogout(router, { oidc, sessions, cookies, logger });
	registerMobileHandoff(router, {
		sessions,
		handoffs,
		settings: options.mobile,
		limitPerMinute: loginLimit,
	});

	const limitPerMinute = options.serverLimitPerMinute;
	registerBackchannelLogout(router, { oidc, sessions, logger, limitPerMinute });
	return router;
}
