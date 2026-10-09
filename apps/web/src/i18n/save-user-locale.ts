import type { Locale } from "@localman/shared/constants";
import { ApiError, apiRequest } from "../lib/api-client";

export const USER_LOCALE_PATH = "/api/v1/users/me/locale";

/**
 * Saves the signed-in user's language so notifications (in-app, Web Push,
 * Telegram) use it. A 404 means the API does not offer the operation yet
 * (older deploy): the choice then lives in this browser only. Other
 * errors reject so the caller can tell the user.
 */
export async function saveUserLocale(locale: Locale): Promise<void> {
	try {
		await apiRequest(USER_LOCALE_PATH, {
			method: "PUT",
			body: { locale },
			redirectOnUnauthorized: false,
		});
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) return;
		throw error;
	}
}
