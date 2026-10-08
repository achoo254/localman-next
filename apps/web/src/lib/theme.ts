export type ThemePreference = "light" | "dark" | "system";

/** Must match the inline bootstrap script in apps/web/index.html. */
export const THEME_STORAGE_KEY = "localman-theme";

export function isThemePreference(value: unknown): value is ThemePreference {
	return value === "light" || value === "dark" || value === "system";
}

/** Reads the saved preference; storage may be unavailable (privacy mode). */
export function readThemePreference(): ThemePreference {
	try {
		const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
		return isThemePreference(stored) ? stored : "system";
	} catch {
		return "system";
	}
}

/**
 * Applies the preference to <html data-theme>. "system" removes the
 * attribute so tokens.css follows `prefers-color-scheme`.
 */
export function applyThemePreference(
	preference: ThemePreference,
	root: HTMLElement = document.documentElement,
): void {
	if (preference === "system") {
		delete root.dataset.theme;
	} else {
		root.dataset.theme = preference;
	}
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, preference);
	} catch {
		// Storage unavailable: the choice still applies for this page view.
	}
}
