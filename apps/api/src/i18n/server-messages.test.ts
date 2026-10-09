import { SUPPORTED_LOCALES } from "@localman/shared";
import { describe, expect, it } from "vitest";
import { renderNotification } from "../modules/notifications/notification-texts.js";
import { formatCount, messagesFor } from "./server-messages.js";

const SAMPLES = [
	["project.invitation", { inviter: "An", project: "Demo", days: 1 }],
	["project.mockUrlChanged", { project: "Demo" }],
	["usage.quota", { threshold: 80, limit: 1000, used: 800, month: "202601" }],
	["usage.quota", { threshold: 100, limit: 1000, used: 1000, month: "202612" }],
] as const;

describe("server messages", () => {
	it.each(SUPPORTED_LOCALES)(
		"renders every notification in %s without holes",
		(locale) => {
			for (const [type, params] of SAMPLES) {
				const text = renderNotification(type, params, locale);
				expect(text?.title).toBeTruthy();
				expect(text?.body).toBeTruthy();
				expect(`${text?.title} ${text?.body}`).not.toMatch(
					/undefined|null|NaN|\[object/,
				);
			}
		},
	);

	it("writes the counted month and counts in each language's style", () => {
		expect(messagesFor("en").formatMonth(2026, 1)).toBe("January 2026");
		expect(messagesFor("zh-CN").formatMonth(2026, 1)).toBe("2026年1月");
		expect(messagesFor("vi").formatMonth(2026, 1)).toBe("01/2026");
		expect(formatCount("en", 10_000)).toBe("10,000");
		expect(formatCount("vi", 10_000)).toBe("10.000");
	});

	it("uses the singular for one day in English", () => {
		const text = renderNotification(...SAMPLES[0], "en");
		expect(text?.body).toContain("expires in 1 day.");
	});

	it("returns null for params of an older or unknown shape", () => {
		expect(
			renderNotification("project.invitation", undefined, "en"),
		).toBeNull();
		expect(renderNotification("usage.quota", { limit: 1 }, "en")).toBeNull();
		expect(renderNotification("project.deleted", {}, "en")).toBeNull();
	});
});
