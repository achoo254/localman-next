import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale } from "./locales.js";

describe("locales", () => {
	it("defaults to English among the supported locales", () => {
		expect(DEFAULT_LOCALE).toBe("en");
		expect(SUPPORTED_LOCALES).toEqual(["en", "zh-CN", "vi"]);
	});

	it.each([
		["en", true],
		["zh-CN", true],
		["vi", true],
		["zh", false],
		["EN", false],
		["", false],
		[null, false],
		[3, false],
	])("isLocale(%j) is %s", (value, expected) => {
		expect(isLocale(value)).toBe(expected);
	});
});
