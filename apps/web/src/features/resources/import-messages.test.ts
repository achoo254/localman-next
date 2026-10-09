import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en/dictionary";
import { createTranslator } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { importErrorText } from "./import-messages";

const { t } = createTranslator("en", en);

describe("importErrorText for a 413", () => {
	it("tells an oversized source from an oversized request", () => {
		const source = new ApiError(413, "SCHEMA_IMPORT_FAILED", "too large", {
			reason: "INPUT_TOO_LARGE",
			max: 2 * 1024 * 1024,
		});
		expect(importErrorText(source, "csv", t)).toBe(
			"The source is over 2 MB. Use a smaller one.",
		);
		const body = new ApiError(
			413,
			"PAYLOAD_TOO_LARGE",
			"Request body is too large",
		);
		expect(importErrorText(body, "csv", t)).toMatch(
			/too large to send once encoded/,
		);
	});
});
