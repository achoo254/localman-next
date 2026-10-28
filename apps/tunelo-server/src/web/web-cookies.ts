import type { CookieOptions, Request, Response } from "express";
import { SESSION_MAX_MS } from "./web-session-store.js";

/** How long a user may take at the IdP before the callback is refused. */
export const AUTH_TRANSACTION_TTL_MS = 5 * 60 * 1000;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface CookieSpec {
	readonly name: string;
	readonly options: CookieOptions;
}

export interface WebCookies {
	readonly session: CookieSpec;
	/** Sealed state, nonce and PKCE verifier of one sign-in in progress. */
	readonly auth: CookieSpec;
	/** The language every hoandat.com app shares (`hd_lang`); readable by their pages, so not HttpOnly. */
	readonly lang: CookieSpec;
	/** Tunelo's own language cookie before the shared one, still read when the shared one is absent. */
	readonly legacyLang: string;
}

/**
 * Cookies of the console. Over https the session and sign-in cookies are
 * `__Host-` (Secure, Path=/, no Domain): every `*.tunnel.hoandat.com` serves
 * arbitrary user content on the same site and must never set or read them.
 * Lax, because the IdP callback is a top-level cross-site navigation.
 */
export function webCookies(publicUrl: string): WebCookies {
	const secure = new URL(publicUrl).protocol === "https:";
	const prefix = secure ? "__Host-" : "";
	const base: CookieOptions = {
		httpOnly: true,
		secure,
		sameSite: "lax",
		path: "/",
	};
	return {
		session: {
			name: `${prefix}tunelo_session`,
			options: { ...base, maxAge: SESSION_MAX_MS },
		},
		auth: {
			name: `${prefix}tunelo_auth`,
			options: { ...base, maxAge: AUTH_TRANSACTION_TTL_MS },
		},
		lang: {
			name: "hd_lang",
			options: { ...base, httpOnly: false, maxAge: YEAR_MS },
		},
		legacyLang: "tunelo_lang",
	};
}

/** A cookie of the request by exact name; the last one wins on duplicates. */
export function readCookie(req: Request, name: string): string | undefined {
	const header = req.headers.cookie;
	if (!header) return undefined;
	let found: string | undefined;
	for (const part of header.split(";")) {
		const separator = part.indexOf("=");
		if (separator < 0) continue;
		if (part.slice(0, separator).trim() !== name) continue;
		found = part.slice(separator + 1).trim();
	}
	return found;
}

export function setCookie(
	res: Response,
	spec: CookieSpec,
	value: string,
): void {
	res.cookie(spec.name, value, spec.options);
}

/** Clears a cookie with the same name, path and flags it was set with. */
export function clearCookie(res: Response, spec: CookieSpec): void {
	const { maxAge: _maxAge, ...options } = spec.options;
	res.clearCookie(spec.name, options);
}
