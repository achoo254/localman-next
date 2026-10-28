import { subscribePreferences } from "@achoo254/app-shell/preferences";
import { DEFAULT_LOCALE, type Locale } from "@localman/shared/constants";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useAccountLocaleSync } from "./account-locale-sync";
import { setActiveTranslator } from "./active-translator";
import { I18nContext, type I18nValue } from "./i18n-context";
import { loadMessages } from "./load-messages";
import {
	readStoredLocale,
	resolvePreferredLocale,
	storeLocale,
} from "./locale-preference";
import type { Messages } from "./message-types";
import { en } from "./messages/en/dictionary";
import { createTranslator } from "./translate";

/** A language with its dictionary already loaded. */
export interface LoadedLocale {
	locale: Locale;
	messages: Messages;
}

export const ENGLISH: LoadedLocale = { locale: DEFAULT_LOCALE, messages: en };

/**
 * The visitor's language, loaded, for a page rendered from scratch (every
 * path but the prerendered landing), so it paints once in the right
 * language. Never rejects: a chunk that fails to load falls back to English.
 */
export async function loadInitialLocale(): Promise<LoadedLocale> {
	const locale = resolvePreferredLocale(window.location.search);
	try {
		return { locale, messages: await loadMessages(locale) };
	} catch {
		return ENGLISH;
	}
}

export interface I18nProviderProps {
	/**
	 * Language of the first render. The prerendered landing and its
	 * hydration use English so the markup matches; the provider then moves
	 * to the visitor's language once that dictionary is loaded.
	 */
	initial?: LoadedLocale;
	children: ReactNode;
}

export function I18nProvider({
	initial = ENGLISH,
	children,
}: I18nProviderProps) {
	const [current, setCurrent] = useState<LoadedLocale>(initial);
	// Last language asked for: a slow chunk must not override a later choice.
	const wanted = useRef<Locale>(initial.locale);
	const shown = useRef<Locale>(initial.locale);

	const switchTo = useCallback(async (locale: Locale): Promise<void> => {
		wanted.current = locale;
		let messages: Messages;
		try {
			messages = await loadMessages(locale);
		} catch (error) {
			if (wanted.current === locale) wanted.current = shown.current;
			throw error;
		}
		if (wanted.current === locale) setCurrent({ locale, messages });
	}, []);

	const setLocale = useCallback(
		async (locale: Locale): Promise<void> => {
			await switchTo(locale);
			storeLocale(locale);
		},
		[switchTo],
	);

	useAccountLocaleSync(setLocale);

	// After hydration (or a first render that did not preload), follow
	// `?lang=` or the saved choice. Failing to load keeps English on screen.
	useEffect(() => {
		const preferred = resolvePreferredLocale(window.location.search);
		if (preferred === wanted.current) return;
		switchTo(preferred).catch(() => {
			// The chunk did not load: stay in the language on screen.
		});
	}, [switchTo]);

	// The language is shared by the hoandat.com apps: a choice made on this
	// page by the footer switch, or in another app and noticed when this
	// page comes back into view, applies here without a reload.
	useEffect(
		() =>
			subscribePreferences(() => {
				const stored = readStoredLocale();
				if (stored === null || stored === wanted.current) return;
				switchTo(stored).catch(() => {
					// The chunk did not load: stay in the language on screen.
				});
			}),
		[switchTo],
	);

	useEffect(() => {
		shown.current = current.locale;
		document.documentElement.lang = current.locale;
	}, [current.locale]);

	const value = useMemo<I18nValue>(() => {
		const translator = createTranslator(current.locale, current.messages);
		// Set while rendering, so plain functions called during this render
		// (validation messages) already speak the new language.
		setActiveTranslator(translator);
		return { ...translator, setLocale };
	}, [current, setLocale]);
	return <I18nContext value={value}>{children}</I18nContext>;
}
