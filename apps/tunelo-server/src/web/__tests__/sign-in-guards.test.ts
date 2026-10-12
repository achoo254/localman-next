import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "vitest";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import { PendingSignIns } from "../sign-in-guards.js";
import { WebSessionModel } from "../web-session-model.js";
import {
	AUTH_COOKIE,
	SESSION_COOKIE,
	type WebHarness,
	startWebHarness,
} from "./web-harness.js";

useTestDatabase("web-sign-in-guards");

let harness: WebHarness;

beforeAll(async () => {
	harness = await startWebHarness();
});

afterAll(() => harness.close());

beforeEach(async () => {
	await WebSessionModel.deleteMany({});
	harness.idp.account.sid = "sid-alice-1";
});

/** Starts a sign-in and returns the callback path plus its sign-in cookie. */
async function startSignIn(): Promise<{ path: string; cookie: string }> {
	const start = await harness.request("/auth/login");
	const back = await harness.idp.authorize(start.headers.location ?? "");
	return {
		path: `${back.pathname}${back.search}`,
		cookie: `${AUTH_COOKIE}=${start.cookies.get(AUTH_COOKIE)}`,
	};
}

describe("single-use sign-in transactions", () => {
	test("a replayed callback never reaches the IdP token endpoint", async () => {
		const { path, cookie } = await startSignIn();
		const first = await harness.request(path, { cookie });
		expect(first.cookies.get(SESSION_COOKIE)).toBeTruthy();
		const calls = harness.idp.tokenRequests;

		for (let i = 0; i < 3; i += 1) {
			const replay = await harness.request(path, { cookie });
			expect(replay.status).toBe(303);
			expect(replay.headers.location).toBe("/?error=login_expired");
			expect(replay.cookies.get(SESSION_COOKIE)).toBeUndefined();
		}
		expect(harness.idp.tokenRequests).toBe(calls);
		expect(await WebSessionModel.countDocuments()).toBe(1);
	});

	test("a forged state does not consume the real sign-in", async () => {
		const { path, cookie } = await startSignIn();
		const forged = path.replace(/state=[^&]+/, "state=forged-forged-forged");
		const before = harness.idp.tokenRequests;
		const refused = await harness.request(forged, { cookie });
		expect(refused.headers.location).toBe("/?error=login_expired");
		expect(harness.idp.tokenRequests).toBe(before);

		const real = await harness.request(path, { cookie });
		expect(real.cookies.get(SESSION_COOKIE)).toBeTruthy();
	});

	test("PendingSignIns: once only, expiry, bounded size", () => {
		let now = 1_000;
		const pending = new PendingSignIns(3, () => now);
		pending.add("a", 2_000);
		expect(pending.consume("a")).toBe(true);
		expect(pending.consume("a")).toBe(false);
		expect(pending.consume("never-issued")).toBe(false);

		pending.add("late", 1_500);
		now = 1_600;
		expect(pending.consume("late")).toBe(false);

		for (const state of ["s1", "s2", "s3", "s4"]) pending.add(state, 9_000);
		expect(pending.size).toBe(3);
		expect(pending.consume("s1")).toBe(false);
		expect(pending.consume("s4")).toBe(true);
	});
});

test("an ID token without sid still signs in, with a warning", async () => {
	harness.idp.account.sid = "";
	await harness.signIn();
	const stored = await WebSessionModel.findOne().lean();
	expect(stored?.sid).toBeNull();
	expect(harness.logs()).toContain(
		"ID token without sid; back-channel logout cannot end this session",
	);
});

test("sign-in routes are limited per client IP (429)", async () => {
	const limited = await startWebHarness(undefined, { signInLimitPerMinute: 3 });
	try {
		for (let i = 0; i < 3; i += 1) {
			expect((await limited.request("/auth/login")).status).toBe(303);
		}
		const blocked = await limited.request("/auth/login");
		expect(blocked.status).toBe(429);
		expect(blocked.headers["retry-after"]).toBe("60");

		const before = limited.idp.tokenRequests;
		for (let i = 0; i < 4; i += 1) {
			await limited.request("/auth/callback?code=x&state=y");
		}
		const callback = await limited.request("/auth/callback?code=x&state=y");
		expect(callback.status).toBe(429);
		expect(limited.idp.tokenRequests).toBe(before);
	} finally {
		await limited.close();
	}
});
