import type { RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { AUTH_PATHS } from "../../operations/protocol-routes.js";
import type { LoginTransaction } from "./login-transaction.js";

/** The native app's `state`: opaque, base64url, 16 to 128 characters. */
export const APP_STATE = /^[A-Za-z0-9_-]{16,128}$/;

/** Codes the web app reads from `/?authError=` after a failed sign-in. */
export type AuthErrorCode =
	| "access_denied"
	| "login_expired"
	| "login_failed"
	| "idp_unavailable"
	| "rate_limited"
	| "account_deleted";

/** Codes the native app reads from its callback's `error`. */
export type MobileErrorCode =
	| AuthErrorCode
	| "invalid_request"
	| "mobile_unavailable";

export function redirectWithError(res: Response, code: AuthErrorCode): void {
	res.redirect(303, `/?authError=${code}`);
}

/**
 * To the app's verified callback on this host (relative, so the tenant's
 * own host): `code` on success, `error` otherwise, with the app's state.
 */
export function redirectToApp(
	res: Response,
	answer: { readonly code: string } | { readonly error: MobileErrorCode },
	appState: string | undefined,
): void {
	const params = new URLSearchParams(
		"code" in answer ? { code: answer.code } : { error: answer.error },
	);
	if (appState !== undefined) params.set("state", appState);
	res.redirect(303, `${AUTH_PATHS.mobileCallback}?${params}`);
}

/** A sign-in that stops with an error: the app's callback or the web's. */
export function redirectToSignInError(
	res: Response,
	transaction: Pick<LoginTransaction, "mobile">,
	code: AuthErrorCode,
): void {
	if (transaction.mobile) {
		redirectToApp(res, { error: code }, transaction.mobile.appState);
	} else {
		redirectWithError(res, code);
	}
}

/**
 * Ends a sign-in that cannot finish. A silent one (`prompt=none`) goes back
 * to its page without an error: being signed out at the IdP is a normal
 * answer there, and the visitor never asked to sign in.
 */
export function redirectAfterFailedSignIn(
	res: Response,
	transaction: Pick<LoginTransaction, "silent" | "returnTo" | "mobile">,
	code: AuthErrorCode,
): void {
	if (transaction.silent) res.redirect(303, transaction.returnTo);
	else redirectToSignInError(res, transaction, code);
}

/**
 * Sign-in starts are cheap to request but each stores a transaction and
 * may hit the IdP's discovery, and each callback consumes one: cap both
 * per client IP (`trust proxy` makes that the real client behind nginx).
 */
export function loginRateLimit(limit: number): RequestHandler {
	return rateLimit({
		windowMs: 60_000,
		limit,
		standardHeaders: "draft-8",
		legacyHeaders: false,
		// A browser navigation: send it back to the app, which explains.
		// A native app's start goes to its callback (its state if valid).
		handler: (req, res) => {
			if (req.query.client !== "mobile") {
				redirectWithError(res, "rate_limited");
				return;
			}
			const state = req.query.state;
			const valid = typeof state === "string" && APP_STATE.test(state);
			redirectToApp(res, { error: "rate_limited" }, valid ? state : undefined);
		},
	});
}
