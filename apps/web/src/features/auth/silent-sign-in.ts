import { isNativeBuild } from "../../platform/native/native-build";
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
	// The shell keeps its session in the secure store: nothing to retry.
	if (isNativeBuild) return false;
	if (!hasCookie(cookies, HINT_COOKIE) || hasCookie(cookies, TRIED_COOKIE)) {
		return false;
	}
	if (new URLSearchParams(search).has("authError")) return false;
	navigateToLogin({ returnTo: currentPath(), prompt: "none" });
	return true;
}

/**
 * Forgets that this browser signed in before (a deleted account): no
 * silent sign-in would bring the visitor back as a new, empty account
 * while the IdP session lasts. The hint is readable by the web, so the web
 * can expire it, with the attributes the API set it with.
 */
export function forgetSilentSignIn(): void {
	const expired = "=; Max-Age=0; Path=/; SameSite=Lax";
	document.cookie = `__Host-${HINT_COOKIE}${expired}; Secure`;
	document.cookie = `${HINT_COOKIE}${expired}`;
}
