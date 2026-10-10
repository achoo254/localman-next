import { describe, expect, it } from "vitest";
import {
	AVAILABLE_TRIAL,
	type TrialInfo,
	canRequestExtension,
	parseTrial,
	trialDaysLeft,
	trialEndPreview,
	trialView,
} from "./trial-state";

/** 10:00 on Oct 10, 2026 in Saigon. */
const NOW = Date.parse("2026-10-10T10:00:00+07:00");

function trial(overrides: Partial<TrialInfo>): TrialInfo {
	return { ...AVAILABLE_TRIAL, ...overrides };
}

describe("parseTrial", () => {
	it("reads a missing or unknown trial as available", () => {
		expect(parseTrial(undefined)).toEqual(AVAILABLE_TRIAL);
		expect(parseTrial({ status: "paused" })).toEqual(AVAILABLE_TRIAL);
		expect(parseTrial("active")).toEqual(AVAILABLE_TRIAL);
	});

	it("keeps the fields of a well-formed trial", () => {
		const value = {
			status: "active",
			startedAt: "2026-10-01T03:00:00.000Z",
			endsAt: "2026-10-31T16:59:59.999Z",
			extensionRequest: {
				status: "pending",
				requestedAt: "2026-10-09T03:00:00.000Z",
				decidedAt: null,
			},
		};
		expect(parseTrial(value)).toEqual(value);
	});

	it("drops a malformed extension request and non-string dates", () => {
		expect(
			parseTrial({
				status: "ended",
				startedAt: 5,
				endsAt: null,
				extensionRequest: { status: "maybe", requestedAt: "x" },
			}),
		).toEqual(trial({ status: "ended" }));
	});
});

describe("trialDaysLeft", () => {
	it("counts Saigon days to the end, the last day being 0", () => {
		expect(trialDaysLeft("2026-10-22T23:59:59.999+07:00", NOW)).toBe(12);
		expect(trialDaysLeft("2026-10-10T23:59:59.999+07:00", NOW)).toBe(0);
	});

	it("gives the same day for an exclusive midnight end", () => {
		expect(trialDaysLeft("2026-10-23T00:00:00+07:00", NOW)).toBe(12);
	});

	it("crosses the UTC date line by Saigon time, not UTC", () => {
		// 06:30 in Saigon is still the previous day in UTC.
		const early = Date.parse("2026-10-10T06:30:00+07:00");
		expect(trialDaysLeft("2026-10-11T23:59:59.999+07:00", early)).toBe(1);
	});

	it("is null without a readable date and never negative", () => {
		expect(trialDaysLeft(null, NOW)).toBeNull();
		expect(trialDaysLeft("soon", NOW)).toBeNull();
		expect(trialDaysLeft("2026-10-01T23:59:59.999+07:00", NOW)).toBe(0);
	});
});

describe("canRequestExtension", () => {
	it("allows a running trial and one ended less than a week ago", () => {
		expect(canRequestExtension(trial({ status: "active" }), NOW)).toBe(true);
		expect(
			canRequestExtension(
				trial({ status: "ended", endsAt: "2026-10-04T23:59:59.999+07:00" }),
				NOW,
			),
		).toBe(true);
	});

	it("refuses after the week, before any trial and while a request waits", () => {
		expect(
			canRequestExtension(
				trial({ status: "ended", endsAt: "2026-10-02T23:59:59.999+07:00" }),
				NOW,
			),
		).toBe(false);
		expect(canRequestExtension(AVAILABLE_TRIAL, NOW)).toBe(false);
		expect(
			canRequestExtension(
				trial({
					status: "active",
					extensionRequest: {
						status: "pending",
						requestedAt: "2026-10-09T03:00:00.000Z",
						decidedAt: null,
					},
				}),
				NOW,
			),
		).toBe(false);
	});
});

describe("trialView", () => {
	it("maps the session to the Pro offer", () => {
		expect(trialView(null)).toBe("guest");
		expect(trialView({ plan: "free", trial: AVAILABLE_TRIAL })).toBe(
			"available",
		);
		expect(trialView({ plan: "pro", trial: trial({ status: "active" }) })).toBe(
			"active",
		);
		expect(trialView({ plan: "free", trial: trial({ status: "ended" }) })).toBe(
			"used",
		);
		expect(trialView({ plan: "pro", trial: AVAILABLE_TRIAL })).toBe("pro");
		expect(trialView({ plan: "pro", trial: trial({ status: "ended" }) })).toBe(
			"pro",
		);
	});
});

it("previews the end day 30 Saigon days ahead", () => {
	expect(trialEndPreview(NOW)).toBe("2026-11-09T12:00:00+07:00");
	// Late evening is still the same Saigon day (16:30 UTC).
	expect(trialEndPreview(Date.parse("2026-10-10T23:30:00+07:00"))).toBe(
		"2026-11-09T12:00:00+07:00",
	);
});
