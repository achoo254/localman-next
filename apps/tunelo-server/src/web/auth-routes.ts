import { Router } from "express";
import {
	newAuthTransaction,
	openAuthTransaction,
	sealAuthTransaction,
} from "./auth-transaction.js";
import { registerBackchannelLogout } from "./backchannel-logout-route.js";
import { LOGIN_PATH } from "./layout.js";
import { registerLogout } from "./logout-route.js";
import {
	IdpUnavailableError,
	describeError,
	oauthErrorCode,
} from "./oidc-errors.js";
import { redirectWithNotice, requestTranslator } from "./page-routes.js";
import { ipRateLimit } from "./sign-in-guards.js";
import type { WebContext } from "./web-context.js";
import { clearCookie, readCookie, setCookie } from "./web-cookies.js";
import { CALLBACK_PATH } from "./web-oidc-client.js";
import { EMPTY_PROFILE, type WebProfile } from "./web-session-store.js";

/** `/auth/*`: sign-in, its callback, sign-out and back-channel logout. */
export function createAuthRouter(ctx: WebContext): Router {
	const { oidc, store, cipher, cookies, logger, pendingSignIns } = ctx;
	const router = Router();
	router.use("/auth", (_req, res, next) => {
		res.set("cache-control", "no-store");
		next();
	});

	router.get(
		LOGIN_PATH,
		ipRateLimit(ctx.signInLimitPerMinute),
		async (req, res) => {
			const transaction = newAuthTransaction();
			let url: URL;
			try {
				url = await oidc.authorizationUrl({
					...transaction,
					uiLocale: requestTranslator(ctx, req).locale,
				});
			} catch (error) {
				if (!(error instanceof IdpUnavailableError)) throw error;
				logger.warn(
					{ err: describeError(error.cause) },
					"IdP unavailable at sign-in",
				);
				redirectWithNotice(res, "idp_unavailable");
				return;
			}
			pendingSignIns.add(transaction.state, transaction.exp);
			setCookie(res, cookies.auth, sealAuthTransaction(cipher, transaction));
			res.redirect(303, url.href);
		},
	);

	router.get(
		CALLBACK_PATH,
		ipRateLimit(ctx.signInLimitPerMinute),
		async (req, res) => {
			const transaction = openAuthTransaction(
				cipher,
				readCookie(req, cookies.auth.name),
			);
			// A forged callback (other state) must not cancel the real sign-in.
			if (!transaction || req.query.state !== transaction.state) {
				redirectWithNotice(res, "login_expired");
				return;
			}
			clearCookie(res, cookies.auth);
			// Single use: a replayed callback never reaches the IdP token endpoint.
			if (!pendingSignIns.consume(transaction.state)) {
				redirectWithNotice(res, "login_expired");
				return;
			}
			let tokens: Awaited<ReturnType<typeof oidc.exchangeCode>>;
			try {
				tokens = await oidc.exchangeCode(
					new URL(req.originalUrl, ctx.config.publicUrl),
					transaction,
				);
			} catch (error) {
				if (error instanceof IdpUnavailableError) {
					redirectWithNotice(res, "idp_unavailable");
					return;
				}
				if (oauthErrorCode(error) === "access_denied") {
					redirectWithNotice(res, "access_denied");
					return;
				}
				logger.warn({ err: describeError(error) }, "Sign-in callback failed");
				redirectWithNotice(res, "login_failed");
				return;
			}
			if (!tokens.sub) {
				logger.warn("ID token without a subject");
				redirectWithNotice(res, "login_failed");
				return;
			}
			if (!tokens.refreshToken) {
				logger.warn(
					"IdP issued no refresh token; the session ends with the access token",
				);
			}
			if (!tokens.sid) {
				logger.warn(
					"ID token without sid; back-channel logout cannot end this session",
				);
			}
			// The profile is cosmetic: without userinfo the session still starts.
			let profile: WebProfile = EMPTY_PROFILE;
			try {
				profile = await oidc.profile(tokens.accessToken, tokens.sub);
			} catch (error) {
				logger.warn(
					{ err: describeError(error) },
					"Userinfo at sign-in failed",
				);
			}
			// A fresh session id at every sign-in (no session fixation).
			const previous = readCookie(req, cookies.session.name);
			const previousSession = previous
				? await store.findByCookie(previous)
				: null;
			if (previousSession) await store.deleteById(previousSession.id);
			const { cookieValue, session } = await store.create({
				sub: tokens.sub,
				sid: tokens.sid,
				profile,
				tokens: {
					refreshToken: tokens.refreshToken,
					idToken: tokens.idToken,
					accessExp: tokens.accessExp,
					refreshExp: tokens.refreshExp,
				},
			});
			logger.info({ sessionId: session.id }, "Web session started");
			setCookie(res, cookies.session, cookieValue);
			res.redirect(303, "/");
		},
	);

	registerLogout(router, ctx);
	registerBackchannelLogout(router, ctx);
	return router;
}
