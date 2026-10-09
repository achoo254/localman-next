import { type RequestHandler, type Response, Router } from "express";
import { rateLimit } from "express-rate-limit";
import * as oidcLib from "openid-client";
import { asyncHandler } from "../../http/async-handler.js";
import { readCookie } from "../../http/cookies.js";
import { noStore } from "../../http/no-store.js";
import type { Logger } from "../../logger.js";
import { AUTH_PATHS } from "../../operations/protocol-routes.js";
import { syncUserFromUserInfo } from "../users/user-sync.js";
import { type AuthCookies, clearCookie } from "./auth-cookies.js";
import { registerBackchannelLogout } from "./backchannel-logout-route.js";
import {
	consumeLoginTransaction,
	newLoginTransaction,
	saveLoginTransaction,
} from "./login-transaction.js";
import type { OidcClient } from "./oidc-client.js";
import { IdpUnavailableError } from "./oidc-errors.js";
import { safeReturnTo } from "./return-to.js";
import type { SessionStore } from "./session-store.js";

export interface AuthRoutesOptions {
	readonly oidc: OidcClient;
	readonly sessions: SessionStore;
	readonly cookies: AuthCookies;
	readonly publicUrl: string;
	readonly logger: Logger;
	/** `GET /auth/login` per client IP and minute (default 20). */
	readonly loginLimitPerMinute?: number;
}

/**
 * Sign-in starts are cheap to request but each stores a transaction and
 * may hit the IdP's discovery: cap them per client IP (`trust proxy` makes
 * that the real client behind nginx).
 */
function loginRateLimit(limit: number): RequestHandler {
	return rateLimit({
		windowMs: 60_000,
		limit,
		standardHeaders: "draft-8",
		legacyHeaders: false,
		// A browser navigation: send it back to the app, which explains.
		handler: (_req, res) => {
			redirectWithError(res, "rate_limited");
		},
	});
}

/** Codes the web app reads from `/?authError=` after a failed sign-in. */
type AuthErrorCode =
	| "access_denied"
	| "login_expired"
	| "login_failed"
	| "idp_unavailable"
	| "rate_limited";

function redirectWithError(res: Response, code: AuthErrorCode): void {
	res.redirect(303, `/?authError=${code}`);
}

/**
 * OpenID Connect endpoints for browsers (`/auth/*`). They are protocol
 * routes, not operations: see operations/protocol-routes.ts.
 */
export function createAuthRouter(options: AuthRoutesOptions): Router {
	const { oidc, sessions, cookies, publicUrl, logger } = options;
	const router = Router();

	router.get(
		AUTH_PATHS.login,
		noStore,
		loginRateLimit(options.loginLimitPerMinute ?? 20),
		asyncHandler(async (req, res) => {
			const transaction = newLoginTransaction(safeReturnTo(req.query.returnTo));
			let url: URL;
			try {
				url = await oidc.authorizationUrl({
					...transaction,
					promptCreate: req.query.prompt === "create",
				});
			} catch (error) {
				if (!(error instanceof IdpUnavailableError)) throw error;
				// A browser navigation: send it somewhere that can explain.
				logger.warn("IdP unavailable at sign-in");
				redirectWithError(res, "idp_unavailable");
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
			let tokens: Awaited<ReturnType<OidcClient["exchangeCode"]>>;
			try {
				tokens = await oidc.exchangeCode(
					new URL(req.originalUrl, publicUrl),
					transaction,
				);
			} catch (error) {
				if (error instanceof oidcLib.AuthorizationResponseError) {
					redirectWithError(
						res,
						error.error === "access_denied" ? "access_denied" : "login_failed",
					);
					return;
				}
				if (error instanceof IdpUnavailableError) {
					redirectWithError(res, "idp_unavailable");
					return;
				}
				logger.warn({ err: error }, "Authorization code exchange failed");
				redirectWithError(res, "login_failed");
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
				redirectWithError(res, "login_failed");
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

	registerBackchannelLogout(router, { oidc, sessions, logger });
	return router;
}
