/**
 * Interface languages of Localman. The web app picks one per visitor and
 * the API keeps it on the user so notifications (in-app, Web Push,
 * Telegram) speak the same language. English is the default: nothing is
 * guessed from the browser.
 */
export const SUPPORTED_LOCALES = ["en", "zh-CN", "vi"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
	return (
		typeof value === "string" &&
		(SUPPORTED_LOCALES as readonly string[]).includes(value)
	);
}
