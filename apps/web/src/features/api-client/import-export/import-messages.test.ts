import { describe, expect, it } from "vitest";
import { en } from "../../../i18n/messages/en/dictionary";
import { vi } from "../../../i18n/messages/vi/dictionary";
import { zhCN } from "../../../i18n/messages/zh-CN/dictionary";
import { createTranslator } from "../../../i18n/translate";
import { importWarningText } from "./import-messages";

const metadata = (field: string) =>
	({ code: "INVALID_METADATA", path: "", params: { field } }) as const;

describe("importWarningText", () => {
	it("names the skipped collection field in each language", () => {
		const english = createTranslator("en", en).t;
		expect(importWarningText(metadata("tags"), english)).toBe(
			"The collection's tags weren't valid and were skipped.",
		);
		expect(importWarningText(metadata("status"), english)).toBe(
			"The collection's status wasn't valid and was skipped.",
		);
		const vietnamese = createTranslator("vi", vi).t;
		expect(importWarningText(metadata("status"), vietnamese)).toContain(
			"Trạng thái",
		);
		const chinese = createTranslator("zh-CN", zhCN).t;
		expect(importWarningText(metadata("tags"), chinese)).toContain("tag");
		expect(importWarningText(metadata("status"), chinese)).toContain("状态");
	});
});
