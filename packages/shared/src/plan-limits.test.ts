import { describe, expect, it } from "vitest";
import {
	FREE_LIMITS,
	PLAN_LIMITS,
	PRO_LIMITS,
	type PlanId,
	limitsFor,
} from "./index.js";

describe("plan limits", () => {
	it("defines the exact Free quotas", () => {
		expect(FREE_LIMITS).toEqual({
			projects: 3,
			resources: 10,
			customResponse: true,
			objectTemplate: true,
			teamWorkspaces: 1,
			membersPerWorkspace: 3,
			forkPrPublic: false,
			mockRequestsPerMonth: 10_000,
			proxyRequestsPerMonth: 5_000,
			trashDays: 30,
			requestLogDays: 7,
			webhookInboxes: 2,
		});
	});

	it("defines the exact Pro quotas with unlimited monthly counters", () => {
		expect(PRO_LIMITS).toEqual({
			projects: 20,
			resources: 50,
			customResponse: true,
			objectTemplate: true,
			teamWorkspaces: Number.POSITIVE_INFINITY,
			membersPerWorkspace: 10,
			forkPrPublic: true,
			mockRequestsPerMonth: null,
			proxyRequestsPerMonth: null,
			trashDays: 30,
			requestLogDays: 30,
			webhookInboxes: 20,
		});
	});

	it("resolves limits by plan id", () => {
		expect(limitsFor("free")).toBe(FREE_LIMITS);
		expect(limitsFor("pro")).toBe(PRO_LIMITS);
	});

	it("rejects an unknown plan id read from untyped storage", () => {
		expect(() => limitsFor("enterprise" as PlanId)).toThrow(
			"Unknown plan id: enterprise",
		);
		expect(() => limitsFor("toString" as PlanId)).toThrow(/Unknown plan id/);
	});

	it("keeps every limits object immutable", () => {
		expect(Object.isFrozen(FREE_LIMITS)).toBe(true);
		expect(Object.isFrozen(PRO_LIMITS)).toBe(true);
		expect(Object.isFrozen(PLAN_LIMITS)).toBe(true);
		expect(() => {
			(FREE_LIMITS as { projects: number }).projects = 99;
		}).toThrow(TypeError);
		expect(limitsFor("free").projects).toBe(3);
	});
});
