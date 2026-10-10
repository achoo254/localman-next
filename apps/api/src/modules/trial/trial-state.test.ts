import { describe, expect, it } from "vitest";
import { overLimitsOf } from "../billing/over-limits.js";
import { dueMilestone } from "./trial-reminders.js";
import {
	DAY_MS,
	canRequestExtension,
	saigonDayEndAfter,
	trialStateOf,
} from "./trial-state.js";

const NOW = new Date("2026-10-10T03:00:00Z");
const later = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

describe("trialStateOf", () => {
	it("is available until a trial is started, even for an owner-granted Pro", () => {
		const free = {
			plan: "free" as const,
			planExpiresAt: null,
			trialStartedAt: null,
		};
		expect(trialStateOf(free, NOW)).toEqual({
			status: "available",
			startedAt: null,
			endsAt: null,
		});
		const granted = {
			plan: "pro" as const,
			planExpiresAt: later(5),
			trialStartedAt: null,
		};
		expect(trialStateOf(granted, NOW).status).toBe("available");
		const forever = { ...granted, planExpiresAt: null };
		expect(trialStateOf(forever, NOW).status).toBe("available");
	});

	it("is active until planExpiresAt, then ended", () => {
		const user = {
			plan: "pro" as const,
			planExpiresAt: later(3),
			trialStartedAt: later(-27),
		};
		expect(trialStateOf(user, NOW)).toEqual({
			status: "active",
			startedAt: user.trialStartedAt,
			endsAt: user.planExpiresAt,
		});
		expect(trialStateOf(user, later(3)).status).toBe("ended");
		expect(trialStateOf(user, later(4)).endsAt).toEqual(user.planExpiresAt);
	});
});

describe("canRequestExtension", () => {
	const ended = (daysAgo: number) =>
		trialStateOf(
			{
				plan: "pro",
				planExpiresAt: later(-daysAgo),
				trialStartedAt: later(-40),
			},
			NOW,
		);

	it("allows a running trial and one ended at most 7 days ago", () => {
		const active = trialStateOf(
			{ plan: "pro", planExpiresAt: later(1), trialStartedAt: later(-29) },
			NOW,
		);
		expect(canRequestExtension(active, NOW)).toBe(true);
		expect(canRequestExtension(ended(7), NOW)).toBe(true);
		expect(canRequestExtension(ended(7.01), NOW)).toBe(false);
		const unused = trialStateOf(
			{ plan: "free", planExpiresAt: null, trialStartedAt: null },
			NOW,
		);
		expect(canRequestExtension(unused, NOW)).toBe(false);
	});
});

describe("saigonDayEndAfter", () => {
	it("ends on the last millisecond of the Saigon day, across the UTC date line", () => {
		expect(saigonDayEndAfter(NOW, 30).toISOString()).toBe(
			"2026-11-09T16:59:59.999Z",
		);
		// 18:00 UTC is already the next day in Saigon.
		const evening = new Date("2026-10-10T18:00:00Z");
		expect(saigonDayEndAfter(evening, 30).toISOString()).toBe(
			"2026-11-10T16:59:59.999Z",
		);
	});
});

describe("dueMilestone", () => {
	const end = new Date("2026-10-20T16:59:59.999Z");
	const at = (hoursBefore: number) =>
		new Date(end.getTime() - hoursBefore * 3_600_000);

	it("names the latest reminder reached", () => {
		expect(dueMilestone(end, at(7 * 24 + 1))).toBeNull();
		expect(dueMilestone(end, at(7 * 24))).toBe("ending7");
		expect(dueMilestone(end, at(25))).toBe("ending7");
		expect(dueMilestone(end, at(24))).toBe("ending1");
		expect(dueMilestone(end, at(0))).toBe("ended");
		expect(dueMilestone(end, at(-7 * 24))).toBe("ended");
		expect(dueMilestone(end, at(-7 * 24 - 1))).toBeNull();
	});
});

describe("overLimitsOf", () => {
	it("lists only the counted limits the plan's numbers are exceeded on", () => {
		expect(overLimitsOf("free", { projects: 3, resources: 10 })).toEqual([]);
		expect(overLimitsOf("free", { projects: 5, resources: 12 })).toEqual([
			{ limit: "projects", used: 5, max: 3 },
			{ limit: "resources", used: 12, max: 10 },
		]);
		expect(overLimitsOf("pro", { projects: 5, resources: 12 })).toEqual([]);
	});
});
