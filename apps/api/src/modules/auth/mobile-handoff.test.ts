import request from "supertest";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { runInTenant } from "../../tenancy/tenant-context.js";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import { MobileHandoffStore, pkceChallengeOf } from "./mobile-handoff-model.js";
import { SessionModel } from "./session-model.js";
import {
	type AuthHarness,
	SESSION_COOKIE,
	setCookies,
	startAuthHarness,
} from "./testing/auth-harness.js";
import {
	TEST_MOBILE_APPS,
	mobileSignIn,
	postConfirm,
	redeem,
	startMobileSignIn,
} from "./testing/mobile-sign-in.js";

let harness: AuthHarness;
let teardownMongo: () => Promise<void>;

beforeAll(async () => {
	teardownMongo = await connectTestMongo();
	harness = await startAuthHarness({ mobile: TEST_MOBILE_APPS });
});

afterAll(async () => {
	await harness?.close();
	await teardownMongo?.();
});

beforeEach(async () => {
	vi.restoreAllMocks();
	await clearCollections();
});

describe("mobile sign-in through the IdP", () => {
	it("confirms, hands the code to the app callback and opens a Bearer session", async () => {
		const { callback, confirm, code, verifier, appState } = await mobileSignIn(
			harness,
			{ query: { locale: "vi" } },
		);
		expect(callback.status).toBe(200);
		expect(callback.headers["content-security-policy"]).toMatch(
			/frame-ancestors 'none'/,
		);
		expect(callback.headers["cache-control"]).toBe("no-store");
		expect(callback.text).toContain(harness.account.email);
		expect(callback.text).toContain("Tiếp tục");
		// No session (and no cookie) before the app redeems the code.
		expect(setCookies(callback).join()).not.toContain(SESSION_COOKIE);
		expect(await SessionModel.countDocuments()).toBe(0);

		expect(confirm.status).toBe(303);
		const target = new URL(confirm.headers.location, "https://x.test");
		expect(target.pathname).toBe("/m/auth/callback");
		expect(target.searchParams.get("code")).toBe(code);
		expect(target.searchParams.get("state")).toBe(appState);

		const token = await redeem(harness, code, verifier);
		expect(token.status).toBe(200);
		expect(token.headers["cache-control"]).toBe("no-store");
		expect(token.body).toEqual({
			token: expect.stringMatching(/^[\w-]{43}$/),
			tokenType: "Bearer",
			expiresAt: expect.any(String),
		});
		const session = await SessionModel.findOne().lean();
		expect(session?.client).toBe("mobile");

		const me = await request(harness.app)
			.get("/api/v1/users/me")
			.set("authorization", `Bearer ${token.body.token}`);
		expect(me.status).toBe(200);
		expect(me.body.email).toBe(harness.account.email);
	});

	it("is always interactive: prompt=none is dropped, no silent-attempt cookie", async () => {
		const res = await request(harness.app)
			.get("/auth/login")
			.query({
				client: "mobile",
				state: "s".repeat(22),
				code_challenge: pkceChallengeOf("v".repeat(43)),
				prompt: "none",
			});
		expect(res.status).toBe(303);
		expect(new URL(res.headers.location).searchParams.has("prompt")).toBe(
			false,
		);
		expect(setCookies(res).join()).not.toContain("lm_sso_tried");
	});

	it("sends malformed app parameters back to the app callback", async () => {
		for (const query of [
			{ client: "mobile", state: "short", code_challenge: "c".repeat(43) },
			{ client: "mobile", state: "s".repeat(22) },
			{
				client: "mobile",
				state: "s".repeat(22),
				code_challenge: "c".repeat(43),
				code_challenge_method: "plain",
			},
		]) {
			const res = await request(harness.app).get("/auth/login").query(query);
			expect(res.status, JSON.stringify(query)).toBe(303);
			expect(res.headers.location).toBe(
				"/m/auth/callback?error=invalid_request",
			);
		}
	});

	it("leaves the browser's web session alone", async () => {
		const web = await harness.signIn();
		const { code, verifier, callback } = await mobileSignIn(harness, {
			cookie: web.cookie,
		});
		expect(setCookies(callback).join()).not.toContain(SESSION_COOKIE);
		expect((await redeem(harness, code, verifier)).status).toBe(200);
		const me = await request(harness.app)
			.get("/api/v1/users/me")
			.set("cookie", web.cookie);
		expect(me.status).toBe(200);
		expect(await SessionModel.countDocuments()).toBe(2);
	});
});

describe("handoff code", () => {
	it("is redeemed once, even by two concurrent requests", async () => {
		const { code, verifier } = await mobileSignIn(harness);
		const answers = await Promise.all([
			redeem(harness, code, verifier),
			redeem(harness, code, verifier),
		]);
		expect(answers.map((res) => res.status).sort()).toEqual([200, 400]);
		const again = await redeem(harness, code, verifier);
		expect(again.body.error.code).toBe("MOBILE_HANDOFF_INVALID");
	});

	it("is burnt by a wrong verifier", async () => {
		const { code, verifier } = await mobileSignIn(harness);
		const wrong = await redeem(harness, code, `${verifier.slice(1)}x`);
		expect(wrong.status).toBe(400);
		expect(wrong.body.error.code).toBe("MOBILE_HANDOFF_INVALID");
		expect((await redeem(harness, code, verifier)).status).toBe(400);
	});

	it("expires a minute after Continue", async () => {
		const { code, verifier } = await mobileSignIn(harness);
		const later = Date.now() + 61_000;
		vi.spyOn(Date, "now").mockReturnValue(later);
		const res = await redeem(harness, code, verifier);
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("MOBILE_HANDOFF_EXPIRED");
	});

	it("needs Continue first, and Cancel ends it", async () => {
		const started = await startMobileSignIn(harness);
		const early = await redeem(harness, started.code, started.verifier);
		expect(early.body.error.code).toBe("MOBILE_HANDOFF_INVALID");

		const other = await startMobileSignIn(harness);
		const cancel = await postConfirm(harness, other.code, "cancel");
		expect(cancel.status).toBe(303);
		expect(cancel.headers.location).toBe(
			`/m/auth/callback?error=access_denied&state=${other.appState}`,
		);
		const late = await postConfirm(harness, other.code, "continue");
		expect(late.status).toBe(410);
		expect(late.headers["content-security-policy"]).toMatch(
			/default-src 'none'/,
		);
		expect(await SessionModel.countDocuments()).toBe(0);
	});

	it("belongs to the tenant whose host started the sign-in", async () => {
		const verifier = "v".repeat(43);
		const otherTenant = { ...TEST_TENANT, id: "ten_other" };
		const store = new MobileHandoffStore(harness.auth.tokenCipher);
		const code = await runInTenant(otherTenant, async () => {
			const created = await store.create({
				sub: harness.account.sub,
				tokens: { accessToken: "at" },
				accessTokenExpiresAt: new Date(Date.now() + 60_000),
				codeChallenge: pkceChallengeOf(verifier),
				appState: "s".repeat(22),
			});
			await store.confirm(created);
			return created;
		});
		const res = await redeem(harness, code, verifier);
		expect(res.body.error.code).toBe("MOBILE_HANDOFF_INVALID");
		const there = await runInTenant(otherTenant, () =>
			store.redeem(code, verifier),
		);
		expect(there.ok).toBe(true);
	});

	it("refuses a malformed request without touching the store", async () => {
		const res = await request(harness.app)
			.post("/auth/mobile/token")
			.send({ code: "nope", code_verifier: "short" });
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("MOBILE_HANDOFF_INVALID");
	});
});
