import { describe, expect, it } from "vitest";
import type { Messages } from "./message-types";
import { en } from "./messages/en/dictionary";
import { vi as viMessages } from "./messages/vi/dictionary";
import { zhCN } from "./messages/zh-CN/dictionary";
import { createTranslator } from "./translate";

const english = createTranslator("en", en);
const vietnamese = createTranslator("vi", viMessages);
const chinese = createTranslator("zh-CN", zhCN);

describe("createTranslator", () => {
	it("returns the text of a dotted key", () => {
		expect(english.t("layout.skipLink")).toBe("Skip to content");
		expect(vietnamese.t("layout.skipLink")).toBe("Bỏ qua tới nội dung");
		expect(chinese.t("layout.skipLink")).toBe("跳到主要内容");
	});

	it("fills {name} placeholders and formats numbers for the language", () => {
		expect(english.t("layout.accountMenu.trigger", { name: "Minh Anh" })).toBe(
			"Minh Anh · Account",
		);
		const limits = { projects: 3, resources: 10, proxy: 10_000 };
		expect(english.t("landing.hero.noteLocalhost", limits)).toContain(
			"10,000 proxy requests",
		);
		expect(vietnamese.t("landing.hero.noteLocalhost", limits)).toContain(
			"10.000 request qua proxy",
		);
	});

	it("keeps strings as given", () => {
		expect(
			english.t("layout.footer.ecosystem", { domain: "hoandat.com" }),
		).toBe("An app from hoandat.com");
	});

	it("picks the plural form with Intl.PluralRules", () => {
		const count = (n: number) =>
			english.t("landing.relations.endpointCount", { count: n });
		expect(count(1)).toBe("1 endpoint");
		expect(count(25)).toBe("25 endpoints");
		expect(count(1000)).toBe("1,000 endpoints");
		// Vietnamese and Chinese only have the `other` category.
		expect(vietnamese.t("landing.relations.endpointCount", { count: 1 })).toBe(
			"1 endpoint",
		);
		expect(chinese.t("landing.relations.endpointCount", { count: 1 })).toBe(
			"1 个 endpoint",
		);
	});

	it("formats dates in Asia/Saigon, dd/mm/yyyy in Vietnamese", () => {
		// 17:30 UTC is already the next day in Asia/Saigon.
		const iso = "2026-10-08T17:30:00.000Z";
		expect(vietnamese.formatDate(iso)).toBe("09/10/2026");
		expect(english.formatDate(iso)).toBe("Oct 9, 2026");
		expect(chinese.formatDate(iso)).toBe("2026年10月9日");
		expect(english.formatDate("not a date")).toBe("");
	});

	it("formats numbers with the language's grouping", () => {
		expect(english.formatNumber(10_000)).toBe("10,000");
		expect(vietnamese.formatNumber(10_000)).toBe("10.000");
		expect(chinese.formatNumber(10_000)).toBe("10,000");
	});
});

describe("t() type checks", () => {
	it("rejects unknown keys and wrong parameters at compile time", () => {
		// Only `tsc` judges these lines; at runtime they must not throw.
		const t = english.t;
		// @ts-expect-error: no such key
		t("landing.hero.missing");
		// @ts-expect-error: `name` is required
		t("layout.accountMenu.trigger");
		// @ts-expect-error: the placeholder is `name`, not `user`
		t("layout.accountMenu.trigger", { user: "x" });
		// @ts-expect-error: a plural message needs a numeric `count`
		t("landing.relations.endpointCount", { count: "3" });
		// @ts-expect-error: a message without placeholders takes no params
		t("layout.skipLink", { name: "x" });
		// @ts-expect-error: a namespace is not a message
		t("layout.publicHeader");
		expect(t("layout.skipLink")).toBe("Skip to content");
	});

	it("requires every key in every translation", () => {
		const { skipLink: _dropped, ...rest } = viMessages.layout;
		// @ts-expect-error: `skipLink` is missing from the layout namespace
		const incomplete: Messages["layout"] = rest;
		const extra: Messages["layout"] = {
			...viMessages.layout,
			// @ts-expect-error: keys that English does not have are refused
			unknownKey: "x",
		};
		expect(incomplete).toBeDefined();
		expect(extra).toBeDefined();
	});
});
