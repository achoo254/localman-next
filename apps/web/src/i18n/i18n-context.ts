import type { Locale } from "@localman/shared/constants";
import { createContext, useContext } from "react";
import { en } from "./messages/en/dictionary";
import { type Translate, type Translator, createTranslator } from "./translate";

export interface I18nValue extends Translator {
	/**
	 * Loads `locale` (lazy chunk), switches every text to it and remembers
	 * the choice in this browser. Rejects when the chunk cannot be fetched;
	 * the current language then stays.
	 */
	setLocale: (locale: Locale) => Promise<void>;
}

/**
 * English, for components rendered outside `<I18nProvider>` (unit tests of
 * a single component). There is nothing to switch to without a provider.
 */
const ENGLISH_ONLY: I18nValue = {
	...createTranslator("en", en),
	setLocale: () =>
		Promise.reject(new Error("setLocale needs an <I18nProvider>")),
};

export const I18nContext = createContext<I18nValue>(ENGLISH_ONLY);

/** Current language, `t()`, number and date formatting, and `setLocale`. */
export function useI18n(): I18nValue {
	return useContext(I18nContext);
}

/** `t(key, params?)` of the current language. */
export function useT(): Translate {
	return useContext(I18nContext).t;
}
