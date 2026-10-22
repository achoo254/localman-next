/**
 * Sign-out of the iOS/Android shell: revokes this device's session on the
 * server (best effort, offline included), forgets the stored token and
 * reloads the app as a guest. The IdP session of the system browser is left
 * alone, as signing out of one app should not sign the user out everywhere.
 */
import { apiUrl } from "../../lib/api-url";
import { forgetMobileSession, mobileAuthHeaders } from "./mobile-session";

export async function signOutOnDevice(): Promise<void> {
	try {
		await fetch(apiUrl("/auth/mobile/logout"), {
			method: "POST",
			headers: { Accept: "application/json", ...mobileAuthHeaders() },
			credentials: "omit",
		});
	} catch {
		// Offline: the token is dropped anyway and expires on the server.
	}
	await forgetMobileSession();
	window.location.assign("/");
}
