import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDashboardApp } from "../../dashboard-server.js";
import { createLogger } from "../../logger.js";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import { PushSubscriptionModel } from "../notifications/push-subscription-model.js";
import { createAuthModule } from "./auth-module.js";
import { SessionModel } from "./session-model.js";
import {
	type AuthHarness,
	LOGIN_COOKIE,
	PUBLIC_URL,
	SESSION_COOKIE,
	cookieFrom,
	startAuthHarness,
} from "./testing/auth-harness.js";
import { TestBrowser } from "./testing/test-browser.js";

let harness: AuthHarness;
let teardownMongo: () => Promise<void>;

beforeAll(async () => {
	teardownMongo = await connectTestMongo();
	harness = await startAuthHarness();
});
afterAll(async () => {
	await harness?.close();
	await teardownMongo?.();
});
beforeEach(clearCollections);

const SUBSCRIPTION = {
	endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
	keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
};

async function registerPush(cookie: string): Promise<void> {
	const res = await request(harness.app)
		.post("/api/v1/push-subscriptions")
		.set("cookie", cookie)
		.set("origin", PUBLIC_URL)
		.send(SUBSCRIPTION);
	expect(res.status).toBe(201);
}

describe("sign-in hardening", () => {
	it("keeps the real sign-in alive when a forged callback arrives first", async () => {
		const start = await request(harness.app).get("/auth/login");
		const loginCookie = cookieFrom(start, LOGIN_COOKIE) ?? "";
		const forged = await request(harness.app)
			.get("/auth/callback?code=attacker&state=forged")
			.set("cookie", loginCookie);
		expect(forged.headers.location).toBe("/?authError=login_expired");
		expect(cookieFrom(forged, LOGIN_COOKIE)).toBeUndefined();

		const { stoppedAt } = await new TestBrowser().navigate(
			start.headers.location,
			`${PUBLIC_URL}/auth/callback`,
		);
		const real = await request(harness.app)
			.get(`${stoppedAt?.pathname}${stoppedAt?.search}`)
			.set("cookie", loginCookie);
		expect(real.headers.location).toBe("/projects");
		expect(cookieFrom(real, SESSION_COOKIE)).toBeDefined();
	});

	it("marks every /api/v1 answer no-store", async () => {
		const { cookie } = await harness.signIn();
		for (const res of [
			await request(harness.app).get("/api/v1/users/me").set("cookie", cookie),
			await request(harness.app).get("/api/v1/users/me"),
		]) {
			expect(res.headers["cache-control"]).toBe("no-store");
		}
	});
});

describe("push devices follow the session", () => {
	it("drops the session's devices on logout", async () => {
		const { cookie } = await harness.signIn();
		await registerPush(cookie);
		const stored = await PushSubscriptionModel.findOne().lean();
		expect(stored?.sessionId).toBe((await SessionModel.findOne().lean())?._id);
		await request(harness.app)
			.post("/auth/logout")
			.set("cookie", cookie)
			.set("origin", PUBLIC_URL);
		expect(await PushSubscriptionModel.countDocuments()).toBe(0);
	});

	it("drops them on back-channel logout and keeps other sessions' devices", async () => {
		const first = await harness.signIn();
		await registerPush(first.cookie);
		const second = await harness.signIn();
		await request(harness.app)
			.post("/api/v1/push-subscriptions")
			.set("cookie", second.cookie)
			.set("origin", PUBLIC_URL)
			.send({ ...SUBSCRIPTION, endpoint: `${SUBSCRIPTION.endpoint}-2` });
		const firstSession = await SessionModel.findOne()
			.sort({ createdAt: 1 })
			.lean();
		await harness.auth.sessions.destroyBySid(firstSession?.sid ?? "");
		const left = await PushSubscriptionModel.find().lean();
		expect(left.map((s) => s.endpoint)).toEqual([`${SUBSCRIPTION.endpoint}-2`]);
	});
});

describe("sign-in start without the IdP", () => {
	const logger = createLogger("silent");
	const auth = createAuthModule(
		{
			issuer: "http://127.0.0.1:9",
			clientId: "localman-web",
			clientSecret: "secret",
			publicUrl: PUBLIC_URL,
			sessionEncryptionKey: `k1:${Buffer.alloc(32, 2).toString("base64")}`,
			loginLimitPerMinute: 2,
			serverLimitPerMinute: 2,
			audit: { clientId: "idp", clientSecret: "s".repeat(32) },
		},
		logger,
	);
	const app = createDashboardApp({
		logger,
		allowedOrigins: [PUBLIC_URL],
		auth,
		trustProxy: "loopback",
	});

	it("redirects to the app with idp_unavailable, then rate limits per IP", async () => {
		const login = () =>
			request(app).get("/auth/login").set("x-forwarded-for", "203.0.113.7");
		for (let i = 0; i < 2; i += 1) {
			const res = await login();
			expect(res.status).toBe(303);
			expect(res.headers.location).toBe("/?authError=idp_unavailable");
			expect(cookieFrom(res, LOGIN_COOKIE)).toBeUndefined();
		}
		const limited = await login();
		expect(limited.status).toBe(303);
		expect(limited.headers.location).toBe("/?authError=rate_limited");
		expect(limited.headers["ratelimit-policy"]).toBeDefined();
		const otherClient = await request(app)
			.get("/auth/login")
			.set("x-forwarded-for", "198.51.100.4");
		expect(otherClient.status).toBe(303);
	});

	it("rate limits forged callbacks per IP like sign-in starts", async () => {
		const callback = () =>
			request(app)
				.get("/auth/callback?state=forged&code=x")
				.set("x-forwarded-for", "203.0.113.8");
		for (let i = 0; i < 2; i += 1) {
			expect((await callback()).headers.location).toBe(
				"/?authError=login_expired",
			);
		}
		expect((await callback()).headers.location).toBe(
			"/?authError=rate_limited",
		);
	});

	it.each([
		["/auth/backchannel-logout", "application/x-www-form-urlencoded", "x=1"],
		["/internal/audit-events", "application/secevent+jwt", "x"],
	])("rate limits %s per IP", async (path, type, body) => {
		const post = () =>
			request(app)
				.post(path)
				.set("x-forwarded-for", "203.0.113.9")
				.set("content-type", type)
				.send(body);
		for (let i = 0; i < 2; i += 1) {
			expect((await post()).status).not.toBe(429);
		}
		const limited = await post();
		expect(limited.status).toBe(429);
		expect(limited.body.error.code).toBe("RATE_LIMITED");
	});
});
