import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import { UserModel } from "../users/user-model.js";
import { SessionModel } from "./session-model.js";
import {
	type AuthHarness,
	LOGIN_COOKIE,
	PUBLIC_URL,
	SESSION_COOKIE,
	cookieFrom,
	setCookies,
	startAuthHarness,
} from "./testing/auth-harness.js";
import { DOT_SEGMENT_REDIRECTS } from "./testing/redirect-payloads.js";

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

beforeEach(async () => {
	await clearCollections();
	harness.account.telegram = { chatId: "424242", username: "dat_tg" };
});

describe("sign-in through the IdP", () => {
	it("redirects to the IdP with PKCE, state, nonce and the Localman scopes", async () => {
		const res = await request(harness.app).get("/auth/login");
		expect(res.status).toBe(303);
		expect(res.headers["cache-control"]).toBe("no-store");
		const target = new URL(res.headers.location);
		expect(target.origin).toBe(harness.issuer);
		const params = target.searchParams;
		expect(params.get("client_id")).toBe("localman-web");
		expect(params.get("redirect_uri")).toBe(`${PUBLIC_URL}/auth/callback`);
		expect(params.get("scope")).toBe("openid profile email telegram");
		expect(params.get("code_challenge_method")).toBe("S256");
		for (const name of ["code_challenge", "state", "nonce"]) {
			expect(params.get(name)).toMatch(/^[\w-]{20,}$/);
		}
		expect(params.has("resource")).toBe(false);
		const login = setCookies(res)[0] ?? "";
		expect(login).toMatch(new RegExp(`^${LOGIN_COOKIE}=`));
		expect(login).toMatch(/HttpOnly/);
		expect(login).toMatch(/Secure/);
		expect(login).toMatch(/SameSite=Lax/);
	});

	it("opens a session cookie and serves the user at /api/v1/users/me", async () => {
		const { cookie, callback } = await harness.signIn({
			returnTo: "/projects/p1?tab=api",
		});
		expect(callback.status).toBe(303);
		expect(callback.headers.location).toBe("/projects/p1?tab=api");
		const setCookie = setCookies(callback).find((c) =>
			c.startsWith(`${SESSION_COOKIE}=`),
		);
		expect(setCookie).toMatch(/; Path=\/; /);
		expect(setCookie).toMatch(/HttpOnly/);
		expect(setCookie).toMatch(/Secure/);
		expect(setCookie).toMatch(/SameSite=Strict/);
		expect(setCookie).not.toMatch(/Domain=/i);

		const me = await request(harness.app)
			.get("/api/v1/users/me")
			.set("cookie", cookie);
		expect(me.status).toBe(200);
		expect(me.body).toEqual({
			sub: "acc_test_1",
			username: "hoandat",
			email: "hoandat@example.com",
			emailVerified: false,
			name: "Hoan Dat",
			picture: null,
			plan: "free",
			telegram: { linked: true, username: "dat_tg" },
		});
		const user = await UserModel.findOne({ sub: "acc_test_1" }).lean();
		expect(user?.telegram?.chatId).toBe("424242");
	});

	it("stores tokens encrypted, keyed by a hash of the cookie", async () => {
		const { cookie } = await harness.signIn();
		const value = cookie.split("=")[1] ?? "";
		const stored = await SessionModel.findOne().lean();
		expect(stored?._id).toMatch(/^[a-f0-9]{64}$/);
		expect(stored?._id).not.toBe(value);
		expect(stored?.tokens).toMatch(/^v1\.k1\./);
		expect(stored?.sid).toEqual(expect.any(String));
		expect(JSON.stringify(stored)).not.toContain(value);
	});

	it("answers 401 without a session or with a forged cookie", async () => {
		const anonymous = await request(harness.app).get("/api/v1/users/me");
		expect(anonymous.status).toBe(401);
		expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");
		const forged = await request(harness.app)
			.get("/api/v1/users/me")
			.set("cookie", `${SESSION_COOKIE}=${"a".repeat(43)}`);
		expect(forged.status).toBe(401);
	});

	it.each([
		"https://evil.example/steal",
		"//evil.example/x",
		"/\\evil.example",
		"javascript:alert(1)",
		...DOT_SEGMENT_REDIRECTS,
	])("blocks returnTo %s and lands on /projects", async (returnTo) => {
		const { callback } = await harness.signIn({ returnTo });
		expect(callback.headers.location).toBe("/projects");
	});

	it("refuses a callback without the browser's login cookie", async () => {
		const res = await request(harness.app).get("/auth/callback?code=x&state=y");
		expect(res.status).toBe(303);
		expect(res.headers.location).toBe("/?authError=login_expired");
		expect(cookieFrom(res, SESSION_COOKIE)).toBeUndefined();
	});

	it("forwards prompt=create only when the IdP advertises it", async () => {
		const res = await request(harness.app).get("/auth/login?prompt=create");
		const discovery = await fetch(
			`${harness.issuer}/.well-known/openid-configuration`,
		);
		const metadata: { prompt_values_supported?: string[] } =
			await discovery.json();
		const supported =
			metadata.prompt_values_supported?.includes("create") ?? false;
		const prompt = new URL(res.headers.location).searchParams.get("prompt");
		expect(prompt).toBe(supported ? "create" : null);
	});
});

describe("CSRF and logout", () => {
	it("rejects a mutation without an allowed Origin", async () => {
		const { cookie } = await harness.signIn();
		const forged = await request(harness.app)
			.post("/api/v1/notifications/read-all")
			.set("cookie", cookie);
		expect(forged.status).toBe(403);
		expect(forged.body.error.code).toBe("CSRF_REJECTED");
		const sibling = await request(harness.app)
			.post("/api/v1/notifications/read-all")
			.set("cookie", cookie)
			.set("origin", "https://secret.localman.test");
		expect(sibling.status).toBe(403);
		const allowed = await request(harness.app)
			.post("/api/v1/notifications/read-all")
			.set("cookie", cookie)
			.set("origin", PUBLIC_URL);
		expect(allowed.status).toBe(200);
		const logout = await request(harness.app)
			.post("/auth/logout")
			.set("cookie", cookie);
		expect(logout.status).toBe(403);
	});

	it("ends the session, then sends the browser to the IdP end_session", async () => {
		const { cookie } = await harness.signIn();
		const res = await request(harness.app)
			.post("/auth/logout")
			.set("cookie", cookie)
			.set("origin", PUBLIC_URL)
			.type("form")
			.send("");
		expect(res.status).toBe(303);
		const target = new URL(res.headers.location);
		expect(target.origin).toBe(harness.issuer);
		expect(target.searchParams.get("id_token_hint")).toMatch(/^ey/);
		expect(target.searchParams.get("post_logout_redirect_uri")).toBe(
			`${PUBLIC_URL}/`,
		);
		expect(setCookies(res).join()).toMatch(new RegExp(`${SESSION_COOKIE}=;`));
		const me = await request(harness.app)
			.get("/api/v1/users/me")
			.set("cookie", cookie);
		expect(me.status).toBe(401);
	});
});
