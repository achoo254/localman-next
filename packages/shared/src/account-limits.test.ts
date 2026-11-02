import { describe, expect, it } from "vitest";
import { LIMITS } from "./index.js";

describe("account limits", () => {
	it("gives every account the same quotas, with no monthly caps", () => {
		expect(LIMITS).toEqual({
			projects: 20,
			resources: 50,
			teamWorkspaces: Number.POSITIVE_INFINITY,
			membersPerWorkspace: 10,
			mockRequestsPerMonth: null,
			proxyRequestsPerMonth: null,
			trashDays: 30,
			requestLogDays: 30,
			webhookInboxes: 20,
		});
	});

	it("keeps the limits immutable", () => {
		expect(Object.isFrozen(LIMITS)).toBe(true);
		expect(() => {
			(LIMITS as { projects: number }).projects = 99;
		}).toThrow(TypeError);
		expect(LIMITS.projects).toBe(20);
	});
});
