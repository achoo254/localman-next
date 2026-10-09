import { afterEach, describe, expect, it, vi } from "vitest";
import {
	LOCALE_STORAGE_KEY,
	readStoredLocale,
	resolvePreferredLocale,
	storeLocale,
} from "./locale-preference";

describe("locale preference", () => {
	afterEach(() => {
		window.localStorage.clear();
		vi.restoreAllMocks();
	});

	it("is English when nothing was chosen, whatever the browser language", () => {
		vi.spyOn(navigator, "language", "get").mockReturnValue("vi-VN");
		vi.spyOn(navigator, "languages", "get").mockReturnValue(["zh-CN", "vi"]);
		expect(resolvePreferredLocale("")).toBe("en");
	});

	it("uses the saved choice", () => {
		storeLocale("vi");
		expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("vi");
		expect(resolvePreferredLocale("")).toBe("vi");
	});

	it("prefers ?lang= and remembers it", () => {
		storeLocale("vi");
		expect(resolvePreferredLocale("?lang=zh-CN")).toBe("zh-CN");
		expect(readStoredLocale()).toBe("zh-CN");
	});

	it("ignores unsupported values", () => {
		window.localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
		expect(resolvePreferredLocale("?lang=zh")).toBe("en");
		expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");
	});

	it("falls back to English when storage throws (privacy mode)", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new DOMException("denied", "SecurityError");
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new DOMException("denied", "SecurityError");
		});
		expect(resolvePreferredLocale("")).toBe("en");
		expect(resolvePreferredLocale("?lang=vi")).toBe("vi");
	});
});
