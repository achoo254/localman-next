import type { Locale } from "@localman/shared/constants";

/**
 * Each language named in itself, the same in every interface language so
 * a reader can find their own. Not translated, hence outside the
 * dictionaries.
 */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
	en: "English",
	"zh-CN": "中文",
	vi: "Tiếng Việt", // check-i18n-ignore: endonym, shown in every language
};
