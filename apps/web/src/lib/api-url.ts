import type { Locale } from "@localman/shared/constants";
import { appConfig } from "./app-config";

/**
 * The only place that turns an `/api/...` or `/auth/...` path into a URL, so
 * a packaged build can point at a remote API by setting VITE_API_BASE_URL.
 */
export function apiUrl(path: string): string {
	if (!path.startsWith("/") || path.startsWith("//")) {
		throw new Error(`API path must be root-relative, got "${path}"`);
	}
	return `${appConfig.apiBaseUrl}${path}`;
}

export interface LoginOptions {
	/** In-app path to come back to after sign-in. */
	returnTo?: string;
	/**
	 * `create` opens the IdP sign-up screen instead of sign-in; `none` signs
	 * in silently, only if the IdP already has a session.
	 */
	prompt?: "create" | "none";
	/** Language the IdP pages should use (sent on as `ui_locales`). */
	locale?: Locale;
	/**
	 * The visitor chose to make a new account after theirs was deleted;
	 * without it the callback stops at that choice.
	 */
	recreate?: boolean;
}

/** Only root-relative in-app paths are allowed back (no open redirect). */
export function isSafeReturnPath(path: string): boolean {
	return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

export function loginUrl({
	returnTo,
	prompt,
	locale,
	recreate,
}: LoginOptions = {}): string {
	const params: string[] = [];
	if (returnTo && isSafeReturnPath(returnTo)) {
		params.push(`returnTo=${encodeURIComponent(returnTo)}`);
	}
	if (prompt) params.push(`prompt=${prompt}`);
	if (locale) params.push(`locale=${encodeURIComponent(locale)}`);
	if (recreate) params.push("recreate=1");
	const query = params.length > 0 ? `?${params.join("&")}` : "";
	return apiUrl(`/auth/login${query}`);
}

export const logoutUrl = (): string => apiUrl("/auth/logout");
