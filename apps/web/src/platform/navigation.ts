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

/** Opens a page on another site in a new tab without sharing `opener`. */
export function openExternal(url: string): void {
	window.open(url, "_blank", "noopener,noreferrer");
}
