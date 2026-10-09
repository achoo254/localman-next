import { DEFAULT_LOCALE, type Locale } from "@localman/shared/constants";
import { useEffect, useRef } from "react";
import { useKnownCurrentUser } from "../features/auth/use-current-user";
import { readStoredLocale } from "./locale-preference";
import { saveUserLocale } from "./save-user-locale";

/**
 * Reconciles this browser's language with the signed-in account's, once
 * per account, when the session becomes known:
 * - no choice in this browser (nor `?lang=`, which is stored on arrival):
 *   the account's language applies here and is remembered;
 * - a choice that differs from the account's: the browser wins and the
 *   account is updated, so notifications follow what the user sees.
 * Failures are silent: both sides keep working with what they have.
 */
export function useAccountLocaleSync(
	setLocale: (locale: Locale) => Promise<void>,
): void {
	const session = useKnownCurrentUser();
	const synced = useRef<string | null>(null);
	const user = session.status === "authenticated" ? session.user : null;

	useEffect(() => {
		if (!user || synced.current === user.sub) return;
		synced.current = user.sub;
		const chosen = readStoredLocale();
		if (chosen === null) {
			if (user.locale !== DEFAULT_LOCALE) {
				setLocale(user.locale).catch(() => {
					// The chunk did not load: stay in the language on screen.
				});
			}
			return;
		}
		if (chosen !== user.locale) {
			saveUserLocale(chosen).catch(() => {
				// Next sign-in tries again; the browser keeps its choice.
			});
		}
	}, [user, setLocale]);
}
