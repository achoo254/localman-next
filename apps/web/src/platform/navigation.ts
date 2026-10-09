/**
 * Browser navigation used outside React Router: full-page redirects to the
 * server's OIDC routes and opening pages on other sites. A desktop/mobile
 * shell can replace this module without touching components.
 */
import { type LoginOptions, loginUrl } from "../lib/api-url";

/** Path, query and hash of the current page, used as `returnTo`. */
export function currentPath(): string {
	const { pathname, search, hash } = window.location;
	return `${pathname}${search}${hash}`;
}

/** Leaves the SPA for `/auth/login`, which redirects to the IdP. */
export function navigateToLogin(options: LoginOptions = {}): void {
	window.location.assign(loginUrl(options));
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
