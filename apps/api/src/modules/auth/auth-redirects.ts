import type { RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { LoginTransaction } from "./login-transaction.js";

/** Codes the web app reads from `/?authError=` after a failed sign-in. */
export type AuthErrorCode =
	| "access_denied"
	| "login_expired"
	| "login_failed"
	| "idp_unavailable"
	| "rate_limited"
	| "account_deleted";

export function redirectWithError(res: Response, code: AuthErrorCode): void {
	res.redirect(303, `/?authError=${code}`);
}

/**
 * Ends a sign-in that cannot finish. A silent one (`prompt=none`) goes back
 * to its page without an error: being signed out at the IdP is a normal
 * answer there, and the visitor never asked to sign in.
 */
export function redirectAfterFailedSignIn(
	res: Response,
	transaction: Pick<LoginTransaction, "silent" | "returnTo">,
	code: AuthErrorCode,
): void {
	if (transaction.silent) res.redirect(303, transaction.returnTo);
	else redirectWithError(res, code);
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
		handler: (_req, res) => {
			redirectWithError(res, "rate_limited");
		},
	});
}
