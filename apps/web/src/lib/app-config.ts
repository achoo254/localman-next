/**
 * Build-time configuration read from `VITE_*` variables. Values are checked
 * once at startup so a bad deploy fails loudly instead of sending requests to
 * a malformed URL.
 */

const DEFAULT_IDP_ORIGIN = "https://auth.hoandat.com";

/** `https://host[:port]` without a trailing slash, or throws. */
export function parseOrigin(raw: string, name: string): string {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error(`${name} must be an absolute http(s) URL, got "${raw}"`);
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error(`${name} must use http or https, got "${raw}"`);
	}
	return url.origin;
}

/** Empty (same origin) or an absolute origin for the API. */
export function parseApiBaseUrl(raw: string | undefined): string {
	const value = raw?.trim() ?? "";
	return value === "" ? "" : parseOrigin(value, "VITE_API_BASE_URL");
}

export function parseIdpOrigin(raw: string | undefined): string {
	const value = raw?.trim() ?? "";
	return parseOrigin(
		value === "" ? DEFAULT_IDP_ORIGIN : value,
		"VITE_IDP_ORIGIN",
	);
}

export const appConfig = {
	apiBaseUrl: parseApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
	idpOrigin: parseIdpOrigin(import.meta.env.VITE_IDP_ORIGIN),
} as const;

/** IdP page for linked sign-in methods (Google, GitHub, Telegram) and sessions. */
export const idpAccountUrl = `${appConfig.idpOrigin}/account`;
