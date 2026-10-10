import { limitsFor } from "@localman/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { saigonMonth } from "../../time/saigon-time.js";
import { UserModel } from "../users/user-model.js";
import { incrementUsage, readUsage, yyyymmOf } from "./usage-counter-model.js";

const USER = "acc_usage";
const DAY_MS = 24 * 60 * 60 * 1000;

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
	it("reports Free usage against the Free limits", async () => {
		await as(USER).send("post", "/projects", { name: "One" });
		await incrementUsage(USER, "mockRequests", 7);
		const res = await as(USER).get("/account/usage");
		expect(res.status).toBe(200);
		const free = limitsFor("free");
		expect(res.body).toEqual({
			plan: "free",
			planExpiresAt: null,
			period: saigonMonth(new Date()),
			projects: { used: 1, max: free.projects },
			mockRequests: { used: 7, max: free.mockRequestsPerMonth },
			proxyRequests: { used: 0, max: free.proxyRequestsPerMonth },
			overLimits: [],
		});
	});

	it("maps uncapped Pro counters to null and treats expired Pro as Free", async () => {
		const expiresAt = new Date(Date.now() + DAY_MS);
		await UserModel.updateOne(
			{ sub: USER },
			{ plan: "pro", planExpiresAt: expiresAt },
		);
		const pro = (await as(USER).get("/account/usage")).body;
		expect(pro.plan).toBe("pro");
		expect(pro.planExpiresAt).toBe(expiresAt.toISOString());
		expect(pro.projects.max).toBe(limitsFor("pro").projects);
		expect(pro.mockRequests.max).toBe(limitsFor("pro").mockRequestsPerMonth);
		expect(pro.proxyRequests.max).toBe(limitsFor("pro").proxyRequestsPerMonth);

		await UserModel.updateOne(
			{ sub: USER },
			{ planExpiresAt: new Date(Date.now() - DAY_MS) },
		);
		const lapsed = (await as(USER).get("/account/usage")).body;
		expect(lapsed.plan).toBe("free");
		expect(lapsed.projects.max).toBe(limitsFor("free").projects);
		const me = (await as(USER).get("/users/me")).body;
		expect(me.plan).toBe("free");
	});
});
