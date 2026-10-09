import type { CookieOptions, Response } from "express";
import { type CookieSpec, cookieSpec } from "../../http/cookies.js";
import { LOGIN_TRANSACTION_TTL_MS } from "./login-transaction.js";
import { SESSION_MAX_MS } from "./session-store.js";

export interface AuthCookies {
	/**
	 * `__Host-lm_session` over https. SameSite=Strict: the public mock
	 * runtime is a sibling subdomain (same site), so Lax would still send it
	 * on requests started from a mock page.
	 */
	readonly session: CookieSpec;
	/**
	 * Pending sign-in handle. Lax, because the IdP callback is a top-level
	 * navigation that Strict could drop.
	 */
	readonly login: CookieSpec;
}

export function authCookies(publicUrl: string): AuthCookies {
	return {
		session: cookieSpec(publicUrl, "lm_session", {
			sameSite: "strict",
			maxAge: SESSION_MAX_MS,
		}),
		login: cookieSpec(publicUrl, "lm_login", {
			sameSite: "lax",
			maxAge: LOGIN_TRANSACTION_TTL_MS,
		}),
	};
}

/** Clears a cookie with the same name, path and flags it was set with. */
export function clearCookie(res: Response, spec: CookieSpec): void {
	const { maxAge: _maxAge, ...options }: CookieOptions = spec.options;
	res.clearCookie(spec.name, options);
}
