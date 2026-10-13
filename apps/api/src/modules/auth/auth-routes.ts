import { isLocale } from "@localman/shared";
import { Router } from "express";
import * as oidcLib from "openid-client";
import { asyncHandler } from "../../http/async-handler.js";
import { readCookie } from "../../http/cookies.js";
import { noStore } from "../../http/no-store.js";
import type { Logger } from "../../logger.js";
import { AUTH_PATHS } from "../../operations/protocol-routes.js";
import { syncUserFromUserInfo } from "../users/user-sync.js";
import { type AuthCookies, clearCookie } from "./auth-cookies.js";
import {
	loginRateLimit,
	redirectAfterFailedSignIn,
	redirectWithError,
} from "./auth-redirects.js";
import { registerBackchannelLogout } from "./backchannel-logout-route.js";
import {
	consumeLoginTransaction,
	newLoginTransaction,
	saveLoginTransaction,
} from "./login-transaction.js";
import type { OidcApi } from "./oidc-api.js";
import { IdpUnavailableError } from "./oidc-errors.js";
import { safeReturnTo } from "./return-to.js";
import type { SessionStore } from "./session-store.js";

export interface AuthRoutesOptions {
	readonly oidc: OidcApi;
	readonly sessions: SessionStore;
	readonly cookies: AuthCookies;
	readonly logger: Logger;
	/** `/auth/login` and `/auth/callback` per client IP and minute (default 20 each). */
	readonly loginLimitPerMinute?: number;
	/** `POST /auth/backchannel-logout` per client IP and minute. */
	readonly serverLimitPerMinute?: number;
}

/** The `prompt` a browser may ask `/auth/login` for. */
function requestedPrompt(value: unknown): "create" | "none" | undefined {
	return value === "create" || value === "none" ? value : undefined;
}

/**
 * OpenID Connect endpoints for browsers (`/auth/*`). They are protocol
 * routes, not operations: see operations/protocol-routes.ts.
 */
export function createAuthRouter(options: AuthRoutesOptions): Router {
	const { oidc, sessions, cookies, logger } = options;
	const router = Router();

	router.get(
		AUTH_PATHS.login,
		noStore,
		loginRateLimit(options.loginLimitPerMinute ?? 20),
		asyncHandler(async (req, res) => {
			const prompt = requestedPrompt(req.query.prompt);
			const silent = prompt === "none";
			const returnTo = safeReturnTo(req.query.returnTo);
			if (silent) {
				// At most one silent attempt a minute, marked before anything
				// can fail: a signed-out IdP or an IdP that is down must not
				// bounce the browser back here in a loop.
				if (readCookie(req, cookies.ssoTried.name)) {
					res.redirect(303, returnTo);
					return;
				}
				res.cookie(cookies.ssoTried.name, "1", cookies.ssoTried.options);
			}
			const transaction = newLoginTransaction(returnTo, silent);
			let url: URL;
			try {
				url = await oidc.authorizationUrl({
					...transaction,
					prompt,
					uiLocale: isLocale(req.query.locale) ? req.query.locale : undefined,
				});
			} catch (error) {
				if (!(error instanceof IdpUnavailableError)) throw error;
				// A browser navigation: send it somewhere that can explain.
				logger.warn("IdP unavailable at sign-in");
				redirectAfterFailedSignIn(res, transaction, "idp_unavailable");
				return;
			}
			await saveLoginTransaction(transaction);
			res.cookie(
				cookies.login.name,
				transaction.cookieValue,
				cookies.login.options,
			);
			res.redirect(303, url.href);
		}),
	);

	router.get(
		AUTH_PATHS.callback,
		noStore,
		loginRateLimit(options.loginLimitPerMinute ?? 20),
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
			try {
				await syncUserFromUserInfo(
					await oidc.userInfo(tokens.accessToken, sub),
					sub,
				);
			} catch (error) {
				logger.warn({ err: error }, "Userinfo at sign-in failed");
				redirectAfterFailedSignIn(res, transaction, "login_failed");
				return;
			}

			// A fresh session id at every sign-in (no session fixation).
			const previous = readCookie(req, cookies.session.name);
			const previousSession = previous
				? await sessions.findByCookie(previous)
				: null;
			if (previousSession) await sessions.destroyById(previousSession.id);
			const { cookieValue } = await sessions.create({
				sub,
				sid: typeof sid === "string" ? sid : undefined,
				tokens: {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					idToken: tokens.idToken,
				},
				accessTokenExpiresAt: tokens.accessTokenExpiresAt,
			});
			res.cookie(cookies.session.name, cookieValue, cookies.session.options);
			res.cookie(cookies.ssoHint.name, "1", cookies.ssoHint.options);
			res.redirect(303, transaction.returnTo);
		}),
	);

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

	const limitPerMinute = options.serverLimitPerMinute;
	registerBackchannelLogout(router, { oidc, sessions, logger, limitPerMinute });
	return router;
}
