import { describe, expect, it } from "vitest";
import { ALERT_EXCERPT_MAX, alertExcerpt } from "./contact-message-alert.js";

describe("alertExcerpt", () => {
	it("defangs links, emails, mentions, hashtags and bot commands", () => {
		const wj = String.fromCharCode(0x2060);
		expect(
			alertExcerpt(
				"Xem https://evil.example/login, hỏi @admin #gấp /start a@b.co v1.5",
			),
		).toBe(
			`Xem hxxps://evil[.]example/login, hỏi @${wj}admin #${wj}gấp /${wj}start a@${wj}b[.]co v1.5`,
		);
	});

	it("keeps the joiners it adds when the text had joiners of its own", () => {
		const wj = String.fromCharCode(0x2060);
		expect(alertExcerpt(`@${wj}${wj}admin`)).toBe(`@${wj} admin`);
	});

	it("flattens lines and strips control and bidi characters", () => {
		expect(alertExcerpt("a\n\nb\t\u202ec\u200bd\u061ce\u0007")).toBe(
			"a b c d e",
		);
	});

	it("cuts long text on a character boundary with an ellipsis", () => {
		const excerpt = alertExcerpt(`${"😀".repeat(ALERT_EXCERPT_MAX)}x`);
		expect(Array.from(excerpt)).toHaveLength(ALERT_EXCERPT_MAX);
		expect(excerpt.endsWith("😀…")).toBe(true);
	});
});
