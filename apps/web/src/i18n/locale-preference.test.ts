import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGACY_LOCALE_KEY } from "../lib/shared-preferences";
import {
	readStoredLocale,
	resolvePreferredLocale,
	storeLocale,
} from "./locale-preference";

/** The shared language cookie of the hoandat.com apps, if set. */
function langCookie(): string | undefined {
	return /(?:^|;\s*)hd_lang=([^;]*)/.exec(document.cookie)?.[1];
}

describe("locale preference", () => {
	afterEach(() => {
		window.localStorage.clear();
		vi.restoreAllMocks();
	});

	it("is English when nothing was chosen and the browser speaks another language", () => {
		vi.spyOn(navigator, "language", "get").mockReturnValue("fr-FR");
		expect(resolvePreferredLocale("")).toBe("en");
	});

	it("follows the browser's language when nothing was chosen", () => {
		vi.spyOn(navigator, "language", "get").mockReturnValue("vi-VN");
		expect(resolvePreferredLocale("")).toBe("vi");
		vi.spyOn(navigator, "language", "get").mockReturnValue("zh-TW");
		expect(resolvePreferredLocale("")).toBe("zh-CN");
	});

	it("stores the choice in the shared cookie and reads it back", () => {
		vi.spyOn(navigator, "language", "get").mockReturnValue("zh-CN");
		storeLocale("vi");
		expect(langCookie()).toBe("vi");
		expect(resolvePreferredLocale("")).toBe("vi");
	});

	it("keeps the choice made before the shared cookie", () => {
		window.localStorage.setItem(LEGACY_LOCALE_KEY, "zh-CN");
		expect(readStoredLocale()).toBe("zh-CN");
		storeLocale("vi");
		expect(readStoredLocale()).toBe("vi");
	});

	it("takes zh-CN from another app as a choice (Localman has Chinese)", () => {
		document.cookie = "hd_lang=zh-CN; Path=/";
		expect(readStoredLocale()).toBe("zh-CN");
	});

	it("prefers ?lang= and remembers it", () => {
		storeLocale("vi");
		expect(resolvePreferredLocale("?lang=zh-CN")).toBe("zh-CN");
		expect(readStoredLocale()).toBe("zh-CN");
	});

	it("ignores unsupported values", () => {
		window.localStorage.setItem(LEGACY_LOCALE_KEY, "fr");
		document.cookie = "hd_lang=fr; Path=/";
		expect(resolvePreferredLocale("?lang=zh")).toBe("en");
		expect(readStoredLocale()).toBeNull();
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
