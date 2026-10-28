import { matchShellLocale } from "@achoo254/app-shell";
import {
	readPreferences,
	writePreference,
} from "@achoo254/app-shell/preferences";
import {
	DEFAULT_LOCALE,
	type Locale,
	isLocale,
} from "@localman/shared/constants";
import { LOCALES, PREFERENCE_OPTIONS } from "../lib/shared-preferences";

/** Query parameter that picks a language from a shared link: `?lang=vi`. */
export const LOCALE_QUERY_PARAM = "lang";

/**
 * The visitor's chosen language: the shared `hd_lang` choice of the
 * hoandat.com apps, else Localman's own key from before it. Null when none
 * of Localman's languages was chosen.
 */
export function readStoredLocale(): Locale | null {
	return readPreferences(PREFERENCE_OPTIONS).lang ?? null;
}

/** Remembers the choice for every hoandat.com app in this browser. */
export function storeLocale(locale: Locale): void {
	writePreference("lang", locale, PREFERENCE_OPTIONS);
}

/** `?lang=` of a query string when it names a supported language. */
export function localeFromSearch(search: string): Locale | null {
	const value = new URLSearchParams(search).get(LOCALE_QUERY_PARAM);
	return isLocale(value) ? value : null;
}

/** The browser's language when Localman has it ("vi-VN" is vi). */
function browserLocale(): Locale | undefined {
	if (typeof navigator === "undefined") return undefined;
	return matchShellLocale(navigator.language, LOCALES);
}

/**
 * Language of this visit: `?lang=` (remembered, so it survives the
 * sign-in round trip), then the saved choice, then the browser's language,
 * then English.
 */
export function resolvePreferredLocale(search: string): Locale {
	const fromQuery = localeFromSearch(search);
	if (fromQuery) {
		storeLocale(fromQuery);
		return fromQuery;
	}
	return readStoredLocale() ?? browserLocale() ?? DEFAULT_LOCALE;
}
