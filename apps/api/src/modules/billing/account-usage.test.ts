import { LIMITS } from "@localman/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { saigonMonth } from "../../time/saigon-time.js";
import { UserModel } from "../users/user-model.js";
import { incrementUsage, readUsage, yyyymmOf } from "./usage-counter-model.js";

const USER = "acc_usage";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: USER, username: "usage" });
});

describe("usage counters", () => {
	it("increment atomically per owner and Saigon month", async () => {
		const totals = await Promise.all(
			Array.from({ length: 20 }, () => incrementUsage(USER, "mockRequests")),
		);
		expect(Math.max(...totals)).toBe(20);
		expect(new Set(totals).size).toBe(20);
		await incrementUsage(USER, "proxyRequests", 3);
		expect(await readUsage(USER)).toEqual({
			mockRequests: 20,
			proxyRequests: 3,
		});

		const lastMonth = new Date("2026-09-30T16:59:00Z");
		expect(yyyymmOf(lastMonth)).toBe("202609");
		await incrementUsage(USER, "mockRequests", 1, lastMonth);
		expect((await readUsage(USER, lastMonth)).mockRequests).toBe(1);
		expect((await readUsage("acc_nobody")).mockRequests).toBe(0);
	});
});

describe("GET /account/usage", () => {
	it("reports usage against the one set of limits, uncapped counters as null", async () => {
		await as(USER).send("post", "/projects", { name: "One" });
		await incrementUsage(USER, "mockRequests", 7);
		const res = await as(USER).get("/account/usage");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({
			plan: "pro",
			period: saigonMonth(new Date()),
			projects: { used: 1, max: LIMITS.projects },
			mockRequests: { used: 7, max: null },
			proxyRequests: { used: 0, max: null },
		});
	});

	it("ignores plan fields still stored on old user documents", async () => {
		await UserModel.collection.updateOne(
			{ sub: USER },
			{ $set: { plan: "free", planExpiresAt: new Date(0) } },
		);
		const usage = (await as(USER).get("/account/usage")).body;
		expect(usage.plan).toBe("pro");
		expect(usage.projects.max).toBe(LIMITS.projects);
		const me = (await as(USER).get("/users/me")).body;
		expect(me.plan).toBe("pro");
		expect(me).not.toHaveProperty("trial");
	});
});
