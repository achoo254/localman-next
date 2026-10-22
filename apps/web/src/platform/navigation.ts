/**
 * Browser navigation used outside React Router: full-page redirects to the
 * server's OIDC routes and opening pages on other sites. A desktop/mobile
 * shell can replace this module without touching components.
 */
import { activeTranslator } from "../i18n/active-translator";
import { type LoginOptions, loginUrl } from "../lib/api-url";
import { appConfig } from "../lib/app-config";
import { isNativeBuild } from "./native/native-build";

/** Path, query and hash of the current page, used as `returnTo`. */
export function currentPath(): string {
	const { pathname, search, hash } = window.location;
	return `${pathname}${search}${hash}`;
}

/**
 * Absolute URL of an in-app page (e.g. an `/invite/:token` link from the
 * API) for sharing outside the app.
 */
export function appPageUrl(path: string): string {
	// The shell's own origin (capacitor://localhost) means nothing to others.
	const base = isNativeBuild ? appConfig.apiBaseUrl : window.location.origin;
	return new URL(path, base).href;
}

/**
 * Leaves the SPA for `/auth/login`, which redirects to the IdP; the IdP
 * pages open in the language on screen unless `options.locale` says else.
 */
export function navigateToLogin(options: LoginOptions = {}): void {
	const withLocale = { locale: activeTranslator().locale, ...options };
	if (isNativeBuild) {
		// The shell signs in through the system browser, never this WebView.
		void import("./native/mobile-sign-in").then(({ signInOnDevice }) =>
			signInOnDevice(withLocale),
		);
		return;
	}
	window.location.assign(loginUrl(withLocale));
}

/**
 * Loads an in-app page from scratch (no state of the current one kept),
 * e.g. after the account was deleted.
 */
export function reloadAt(path: string): void {
	window.location.assign(path);
}

/**
 * The URL when it is an absolute http(s) address, else null. Links built
 * from data (mock URLs, IdP pages) must never run `javascript:` or open
 * `data:`/`file:` documents.
 */
export function safeExternalUrl(url: string): string | null {
	try {
		const { protocol } = new URL(url);
		return protocol === "http:" || protocol === "https:" ? url : null;
	} catch {
		return null;
	}
}

/**
 * Opens a page on another site in a new tab without sharing `opener`.
 * Anything but http(s) is ignored; returns whether a tab was opened.
 */
export function openExternal(url: string): boolean {
	if (safeExternalUrl(url) === null) return false;
	window.open(url, "_blank", "noopener,noreferrer");
	return true;
}
