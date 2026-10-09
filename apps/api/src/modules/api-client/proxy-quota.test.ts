import { describe, expect, it } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../config/runtime-settings.js";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import {
	UsageCounterModel,
	readUsage,
	yyyymmOf,
} from "../billing/usage-counter-model.js";
import { UserModel } from "../users/user-model.js";
import { PROXY_TEST_USER, postProxy, proxyTestApp } from "./proxy-test-app.js";
import { useTestServer } from "./proxy-test-server.js";

const server = useTestServer();
const app = proxyTestApp();
const USER = PROXY_TEST_USER;

useDashboardTestDb();

function setMonthUsage(proxyRequests: number) {
	return UsageCounterModel.updateOne(
		{ ownerSub: USER, yyyymm: yyyymmOf(new Date()) },
		{ $set: { proxyRequests } },
		{ upsert: true },
	);
}

describe("proxy quota", () => {
	it("counts proxied requests in the month and stops Free at 5000", async () => {
		await postProxy(app, { method: "GET", url: server.origin }).expect(200);
		expect((await readUsage(USER)).proxyRequests).toBe(1);
		await setMonthUsage(4999);
		await postProxy(app, { method: "GET", url: server.origin }).expect(200);
		const res = await postProxy(app, { method: "GET", url: server.origin });
		expect(res.status).toBe(429);
		expect(res.body.error).toMatchObject({
			code: "MONTHLY_QUOTA_EXCEEDED",
			details: { limit: "proxyRequests", max: 5000, used: 5000 },
		});
		// The refused request gave its slot back.
		expect((await readUsage(USER)).proxyRequests).toBe(5000);
	});

	it("counts a request whose target is refused", async () => {
		await postProxy(app, { method: "GET", url: "http://10.0.0.1/" }).expect(
			403,
		);
		expect((await readUsage(USER)).proxyRequests).toBe(1);
	});

	it("does not cap Pro", async () => {
		await UserModel.create({ sub: USER, username: "pro", plan: "pro" });
		await setMonthUsage(50_000);
		await postProxy(app, { method: "GET", url: server.origin }).expect(200);
		expect((await readUsage(USER)).proxyRequests).toBe(50_001);
	});

	it("caps a lapsed Pro like Free", async () => {
		await UserModel.create({
			sub: USER,
			username: "lapsed",
			plan: "pro",
			planExpiresAt: new Date(Date.now() - 60_000),
		});
		await setMonthUsage(5000);
		const res = await postProxy(app, { method: "GET", url: server.origin });
		expect(res.body.error.code).toBe("MONTHLY_QUOTA_EXCEEDED");
	});

	it("rate limits each account", async () => {
		configureRuntime({
			...DEFAULT_RUNTIME_SETTINGS,
			proxyRateLimit: { max: 2, windowMs: 60_000 },
		});
		await postProxy(app, { method: "GET", url: server.origin }).expect(200);
		await postProxy(app, { method: "GET", url: server.origin }).expect(200);
		const res = await postProxy(app, { method: "GET", url: server.origin });
		expect(res.status).toBe(429);
		expect(res.body.error.code).toBe("RATE_LIMITED");
		// A refused request is not counted in the month.
		expect((await readUsage(USER)).proxyRequests).toBe(2);
		const other = { method: "GET", url: server.origin };
		await postProxy(app, other, "acc_other").expect(200);
	});
});
