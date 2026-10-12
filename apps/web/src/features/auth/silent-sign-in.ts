import { currentPath, navigateToLogin } from "../../platform/navigation";

/**
 * Cookies the API sets for silent sign-in (apps/api auth-cookies.ts), with
 * the `__Host-` prefix over https and without it over http://localhost.
 */
const HINT_COOKIE = "lm_sso_hint";
const TRIED_COOKIE = "lm_sso_tried";

function hasCookie(cookies: string, baseName: string): boolean {
	return cookies.split(";").some((part) => {
		const name = part.split("=")[0]?.trim();
		return name === baseName || name === `__Host-${baseName}`;
	});
}

/**
 * Leaves for the IdP with `prompt=none` when this browser has signed in to
 * Localman before, no silent attempt ran in the last minute and the page
 * is not reporting a failed sign-in. Signed in at the IdP, the visitor
 * comes back signed in here; otherwise back to the same page as a guest.
 * Returns whether it navigated away.
 */
export function trySilentSignIn(
	cookies: string = document.cookie,
	search: string = window.location.search,
): boolean {
	if (!hasCookie(cookies, HINT_COOKIE) || hasCookie(cookies, TRIED_COOKIE)) {
		return false;
	}
	if (new URLSearchParams(search).has("authError")) return false;
	navigateToLogin({ returnTo: currentPath(), prompt: "none" });
	return true;
}
