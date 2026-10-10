import { SUPPORTED_LOCALES } from "@localman/shared";
import { describe, expect, it } from "vitest";
import { messagesFor } from "../../i18n/server-messages.js";
import { renderNotification } from "../notifications/notification-texts.js";

const SAMPLES = [
	["trial.ending", { daysLeft: 7, endsOn: "2026-11-09" }],
	["trial.ending", { daysLeft: 1, endsOn: "2026-11-09" }],
	["trial.ended", { endsOn: "2026-11-09" }],
	["trial.extension.requested", { user: "Lan" }],
	["trial.extension.approved", { endsOn: "2026-12-09" }],
	["trial.extension.declined", undefined],
] as const;

describe("trial texts", () => {
	it.each(SUPPORTED_LOCALES)("renders every trial event in %s", (locale) => {
		for (const [type, params] of SAMPLES) {
			const text = renderNotification(type, params, locale);
			expect(text?.title).toBeTruthy();
			expect(text?.body).toBeTruthy();
			expect(`${text?.title} ${text?.body}`).not.toMatch(
				/undefined|null|NaN|\[object/,
			);
		}
		const alert = messagesFor(locale).trial.ownerAlert({
			user: "Lan",
			date: null,
		});
		expect(alert).toContain("Lan");
	});

	it("writes the end day in each language's style", () => {
		expect(messagesFor("en").trial.formatDay("2026-11-09")).toBe(
			"November 9, 2026",
		);
		expect(messagesFor("vi").trial.formatDay("2026-11-09")).toBe("09/11/2026");
		expect(messagesFor("zh-CN").trial.formatDay("2026-11-09")).toBe(
			"2026年11月9日",
		);
		const one = renderNotification("trial.ending", SAMPLES[1][1], "en");
		expect(one?.title).toBe("Your Pro trial ends in 1 day");
	});
});
