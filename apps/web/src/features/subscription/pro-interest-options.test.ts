import { describe, expect, it } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { proNeedsFor, sourceNeedFor } from "./pro-interest-options";

const ids = (flags: typeof NO_FEATURES) => proNeedsFor(flags).map((c) => c.id);

describe("Pro interest needs by released features", () => {
	it("offers only what runs today while every flag is off", () => {
		expect(ids(NO_FEATURES)).toEqual(["mock", "team"]);
	});

	it("adds API client and Tunelo with apiClient, MCP with mockMcp", () => {
		expect(ids({ ...NO_FEATURES, apiClient: true })).toEqual([
			"mock",
			"api_client",
			"team",
			"tunelo",
		]);
		expect(ids({ ...NO_FEATURES, mockMcp: true })).toContain("mcp");
	});

	it("never offers DevOps/CI, which has no flag yet", () => {
		const all = {
			apiClient: true,
			liveMockSync: true,
			mockMcp: true,
			directMode: true,
			hybridMock: true,
		};
		expect(ids(all)).not.toContain("devops_ci");
		expect(sourceNeedFor("devops", all)).toBeUndefined();
	});

	it("does not pre-tick a hidden need", () => {
		expect(sourceNeedFor("plan_limit_proxy", NO_FEATURES)).toBeUndefined();
		expect(
			sourceNeedFor("plan_limit_proxy", { ...NO_FEATURES, apiClient: true }),
		).toBe("api_client");
		expect(sourceNeedFor("plan_limit_projects", NO_FEATURES)).toBe("mock");
	});
});
