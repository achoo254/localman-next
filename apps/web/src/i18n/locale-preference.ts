import {
	DEFAULT_LOCALE,
	type Locale,
	isLocale,
} from "@localman/shared/constants";

export const LOCALE_STORAGE_KEY = "localman-locale";

/** Query parameter that picks a language from a shared link: `?lang=vi`. */
export const LOCALE_QUERY_PARAM = "lang";

/** The saved choice; storage may be unavailable (privacy mode). */
export function readStoredLocale(): Locale | null {
	try {
		const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
		return isLocale(stored) ? stored : null;
	} catch {
		return null;
	}
}

export function storeLocale(locale: Locale): void {
	try {
		window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
	} catch {
		// Storage unavailable: the choice still applies for this page view.
	}
}

/** `?lang=` of a query string when it names a supported language. */
export function localeFromSearch(search: string): Locale | null {
	const value = new URLSearchParams(search).get(LOCALE_QUERY_PARAM);
	return isLocale(value) ? value : null;
}

/**
 * Language of this visit: `?lang=` (remembered, so it survives the
 * sign-in round trip), then the saved choice, then English. The browser's
 * own language is deliberately ignored: English is the product default.
 */
export function resolvePreferredLocale(search: string): Locale {
	const fromQuery = localeFromSearch(search);
	if (fromQuery) {
		storeLocale(fromQuery);
		return fromQuery;
	}
	return readStoredLocale() ?? DEFAULT_LOCALE;
}
