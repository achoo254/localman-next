import type { CookieOptions, Response } from "express";
import { type CookieSpec, cookieSpec } from "../../http/cookies.js";
import { LOGIN_TRANSACTION_TTL_MS } from "./login-transaction.js";
import { SESSION_MAX_MS } from "./session-store.js";

/** Wait after a silent sign-in attempt before the next one may start. */
export const SILENT_SIGN_IN_RETRY_MS = 60 * 1000;

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
	/**
	 * "This browser has signed in to Localman before": the web tries a
	 * silent sign-in (`prompt=none`) only then, so first-time visitors and
	 * crawlers never bounce through the IdP. Value `1`, readable by the web,
	 * set at every sign-in and cleared by logout.
	 */
	readonly ssoHint: CookieSpec;
	/**
	 * A silent sign-in started less than a minute ago: neither the web nor
	 * `/auth/login` starts another, so an IdP without a session cannot cause
	 * a redirect loop. Readable by the web.
	 */
	readonly ssoTried: CookieSpec;
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
		ssoHint: cookieSpec(publicUrl, "lm_sso_hint", {
			sameSite: "lax",
			maxAge: SESSION_MAX_MS,
			httpOnly: false,
		}),
		ssoTried: cookieSpec(publicUrl, "lm_sso_tried", {
			sameSite: "lax",
			maxAge: SILENT_SIGN_IN_RETRY_MS,
			httpOnly: false,
		}),
	};
}

/** Clears a cookie with the same name, path and flags it was set with. */
export function clearCookie(res: Response, spec: CookieSpec): void {
	const { maxAge: _maxAge, ...options }: CookieOptions = spec.options;
	res.clearCookie(spec.name, options);
}
