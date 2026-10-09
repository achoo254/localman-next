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
	/** `create` opens the IdP sign-up screen instead of sign-in. */
	prompt?: "create";
}

/** Only root-relative in-app paths are allowed back (no open redirect). */
export function isSafeReturnPath(path: string): boolean {
	return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

export function loginUrl({ returnTo, prompt }: LoginOptions = {}): string {
	const params: string[] = [];
	if (returnTo && isSafeReturnPath(returnTo)) {
		params.push(`returnTo=${encodeURIComponent(returnTo)}`);
	}
	if (prompt) params.push(`prompt=${prompt}`);
	const query = params.length > 0 ? `?${params.join("&")}` : "";
	return apiUrl(`/auth/login${query}`);
}

export const logoutUrl = (): string => apiUrl("/auth/logout");
