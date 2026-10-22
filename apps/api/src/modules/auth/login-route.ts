import { isLocale } from "@localman/shared";
import type { Router } from "express";
import { asyncHandler } from "../../http/async-handler.js";
import { readCookie } from "../../http/cookies.js";
import { noStore } from "../../http/no-store.js";
import type { Logger } from "../../logger.js";
import { AUTH_PATHS } from "../../operations/protocol-routes.js";
import {
	type MobileAppSettings,
	mobileSignInEnabled,
} from "./app-link-association.js";
import type { AuthCookies } from "./auth-cookies.js";
import {
	loginRateLimit,
	redirectAfterFailedSignIn,
	redirectToApp,
} from "./auth-redirects.js";
import {
	mobileSignInFrom,
	newLoginTransaction,
	saveLoginTransaction,
} from "./login-transaction.js";
import type { OidcApi } from "./oidc-api.js";
import { IdpUnavailableError } from "./oidc-errors.js";
import { safeReturnTo } from "./return-to.js";

export interface LoginRouteOptions {
	readonly oidc: OidcApi;
	readonly cookies: AuthCookies;
	readonly logger: Logger;
	/** Native apps that may sign in; none: `client=mobile` is refused. */
	readonly mobile?: MobileAppSettings;
	readonly limitPerMinute: number;
}

/** The `prompt` a browser may ask `/auth/login` for. */
function requestedPrompt(value: unknown): "create" | "none" | undefined {
	return value === "create" || value === "none" ? value : undefined;
}

/**
 * `GET /auth/login`: to the IdP with Code + PKCE. `client=mobile` (the
 * native app, with its `state` and S256 `code_challenge`) is always
 * interactive: `prompt=none` is ignored.
 */
export function registerLogin(
	router: Router,
	{ oidc, cookies, logger, mobile: apps, limitPerMinute }: LoginRouteOptions,
): void {
	router.get(
		AUTH_PATHS.login,
		noStore,
		loginRateLimit(limitPerMinute),
		asyncHandler(async (req, res) => {
			// The native app: always interactive, its own state and PKCE.
			const isMobile = req.query.client === "mobile";
			const mobile = isMobile ? mobileSignInFrom(req.query) : undefined;
			if (isMobile && !mobileSignInEnabled(apps)) {
				redirectToApp(res, { error: "mobile_unavailable" }, mobile?.appState);
				return;
			}
			if (mobile === null) {
				redirectToApp(res, { error: "invalid_request" }, undefined);
				return;
			}
			const asked = requestedPrompt(req.query.prompt);
			const prompt = mobile && asked === "none" ? undefined : asked;
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
			const recreate = !mobile && req.query.recreate === "1";
			const transaction = newLoginTransaction(
				returnTo,
				silent,
				recreate,
				mobile,
			);
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
}
