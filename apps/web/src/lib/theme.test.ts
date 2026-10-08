import { afterEach, describe, expect, it } from "vitest";
import {
	THEME_STORAGE_KEY,
	applyThemePreference,
	readThemePreference,
} from "./theme";

describe("theme preference", () => {
	afterEach(() => {
		window.localStorage.clear();
		delete document.documentElement.dataset.theme;
	});

	it("defaults to system when nothing valid is stored", () => {
		expect(readThemePreference()).toBe("system");
		window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
		expect(readThemePreference()).toBe("system");
	});

	it("sets data-theme for light/dark and removes it for system", () => {
		applyThemePreference("dark");
		expect(document.documentElement.dataset.theme).toBe("dark");
		expect(readThemePreference()).toBe("dark");

		applyThemePreference("system");
		expect(document.documentElement.dataset.theme).toBeUndefined();
		expect(readThemePreference()).toBe("system");
	});
});
