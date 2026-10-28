import {
	type LocalePreferenceOptions,
	applyTheme,
	readPreferences,
	subscribePreferences,
	themeBootstrapScript,
} from "@achoo254/app-shell/preferences";
import { brand } from "@localman/shared/brand";
import type { Locale } from "@localman/shared/constants";

/*
 * Language and theme are shared choices of every hoandat.com app
 * (@achoo254/app-shell: the `hd_lang` and `hd_theme` cookies on the root
 * domain, this WebView's storage in the mobile app). This module says
 * where Localman reads and writes them; the switches of the package write
 * them, the I18nProvider and `watchSharedTheme` follow them.
 */

/** Localman's languages, in the order of the language switch. */
export const LOCALES = [
	"en",
	"zh-CN",
	"vi",
] as const satisfies readonly Locale[];

/** The root domain the shared cookies belong to (hoandat.com). */
export const PREFERENCE_DOMAIN = brand.primaryTenant.domain;

/**
 * localStorage keys of Localman's choices before the shared cookies: read
 * while the visitor has no shared choice yet, so nobody loses the theme or
 * language they picked.
 */
export const LEGACY_THEME_KEY = "localman-theme";
export const LEGACY_LOCALE_KEY = "localman-locale";

export const PREFERENCE_OPTIONS: LocalePreferenceOptions<Locale> = {
	domain: PREFERENCE_DOMAIN,
	locales: LOCALES,
	legacyThemeKey: LEGACY_THEME_KEY,
	legacyLangKey: LEGACY_LOCALE_KEY,
};

/**
 * The inline <head> script that sets `data-theme` before the first paint.
 * vite.config.ts puts it in index.html; deploy.sh allows it in the CSP by
 * the hash of the built file (infra/localman/csp-hashes.mjs), and
 * theme-bootstrap.test.ts checks that chain.
 */
export const THEME_BOOTSTRAP_SCRIPT = themeBootstrapScript({
	legacyThemeKey: LEGACY_THEME_KEY,
});

/**
 * From now on, applies the stored theme whenever it changes: a switch on
 * this page, or another app's choice noticed when the page comes back into
 * view (pages without a footer, such as the API client, have no switch to
 * do it). Returns the cleanup.
 */
export function watchSharedTheme(): () => void {
	return subscribePreferences(() => {
		applyTheme(readPreferences(PREFERENCE_OPTIONS).theme);
	});
}
