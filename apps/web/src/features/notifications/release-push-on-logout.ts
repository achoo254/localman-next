import { pushSupport } from "../../platform/push-support";
import { deletePushSubscription } from "./notification-preferences-api";

/** Logout must not hang on a slow API; the cleanup gives up after this. */
const CLEANUP_TIMEOUT_MS = 3000;

/**
 * Before signing out, detach this browser from the user's Web Push so the
 * next person on a shared device does not receive their notifications.
 * Best effort: never rejects, so logout always goes ahead.
 */
export async function releasePushSubscriptionForLogout(): Promise<void> {
	let endpoint: string | null;
	try {
		endpoint = await pushSupport.currentEndpoint();
	} catch {
		return;
	}
	if (!endpoint) return;
	try {
		await deletePushSubscription(endpoint, {
			// An expired session must not bounce the user to the login page
			// in the middle of logging out.
			redirectOnUnauthorized: false,
			signal: AbortSignal.timeout(CLEANUP_TIMEOUT_MS),
		});
	} catch {
		// The server copy is dropped later: once the browser unsubscribes
		// below, the push service answers 410 and the API deletes it.
	}
	try {
		await pushSupport.unsubscribe();
	} catch {
		// Nothing else to do; logout proceeds regardless.
	}
}
