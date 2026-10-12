import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import {
	type AuthHarness,
	LOGIN_COOKIE,
	PUBLIC_URL,
	SESSION_COOKIE,
	cookieFrom,
	setCookies,
	startAuthHarness,
} from "./testing/auth-harness.js";
import { TestBrowser } from "./testing/test-browser.js";

const HINT_COOKIE = "__Host-lm_sso_hint";
const TRIED_COOKIE = "__Host-lm_sso_tried";

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
});

function setCookie(res: request.Response, name: string): string {
	return setCookies(res).find((c) => c.startsWith(`${name}=`)) ?? "";
}

/** `/auth/login?prompt=none` in `browser`, through the IdP, to the callback. */
async function silentSignIn(browser: TestBrowser, returnTo: string) {
	const start = await request(harness.app)
		.get("/auth/login")
		.query({ prompt: "none", returnTo });
	const { stoppedAt } = await browser.navigate(
		start.headers.location,
		`${PUBLIC_URL}/auth/callback`,
	);
	if (!stoppedAt) throw new Error("the IdP did not return to Localman");
	const callback = await request(harness.app)
		.get(`${stoppedAt.pathname}${stoppedAt.search}`)
		.set("cookie", cookieFrom(start, LOGIN_COOKIE) ?? "");
	return { start, idpAnswer: stoppedAt, callback };
}

describe("silent sign-in (prompt=none)", () => {
	it("asks the IdP for prompt=none and marks the attempt for a minute", async () => {
		const res = await request(harness.app).get("/auth/login?prompt=none");
		expect(res.status).toBe(303);
		const target = new URL(res.headers.location);
		expect(target.origin).toBe(harness.issuer);
		expect(target.searchParams.get("prompt")).toBe("none");
		const tried = setCookie(res, TRIED_COOKIE);
		expect(tried).toMatch(/Max-Age=60;/);
		expect(tried).toMatch(/Secure/);
		expect(tried).toMatch(/SameSite=Lax/);
		// The web reads it to avoid starting another attempt.
		expect(tried).not.toMatch(/HttpOnly/);
	});

	it("does not start a second attempt within the minute", async () => {
		const res = await request(harness.app)
			.get("/auth/login?prompt=none&returnTo=/docs")
			.set("cookie", `${TRIED_COOKIE}=1`);
		expect(res.status).toBe(303);
		expect(res.headers.location).toBe("/docs");
		expect(cookieFrom(res, LOGIN_COOKIE)).toBeUndefined();
	});

	it("signs in without any IdP page when the IdP has a session", async () => {
		const { browser } = await harness.signIn();
		const { callback } = await silentSignIn(browser, "/pricing");
		expect(callback.status).toBe(303);
		expect(callback.headers.location).toBe("/pricing");
		const session = cookieFrom(callback, SESSION_COOKIE);
		expect(session).toBeDefined();
		const me = await request(harness.app)
			.get("/api/v1/users/me")
			.set("cookie", session ?? "");
		expect(me.status).toBe(200);
		expect(me.body.sub).toBe(harness.account.sub);
	});

	it("goes back to the page as a guest, without an error, when the IdP has no session", async () => {
		const { idpAnswer, callback } = await silentSignIn(
			new TestBrowser(),
			"/docs?x=1",
		);
		expect(idpAnswer.searchParams.get("error")).toBe("login_required");
		expect(callback.status).toBe(303);
		expect(callback.headers.location).toBe("/docs?x=1");
		expect(cookieFrom(callback, SESSION_COOKIE)).toBeUndefined();
		expect(cookieFrom(callback, HINT_COOKIE)).toBeUndefined();
	});

	it("still reports a failed interactive sign-in", async () => {
		const start = await request(harness.app).get("/auth/login");
		const state = new URL(start.headers.location).searchParams.get("state");
		const res = await request(harness.app)
			.get("/auth/callback")
			.query({ error: "access_denied", state, iss: harness.issuer })
			.set("cookie", cookieFrom(start, LOGIN_COOKIE) ?? "");
		expect(res.headers.location).toBe("/?authError=access_denied");
	});
});

describe("the hint that this browser signed in before", () => {
	it("is set, readable by the web, at every sign-in", async () => {
		const { callback } = await harness.signIn();
		const hint = setCookie(callback, HINT_COOKIE);
		expect(hint).toMatch(new RegExp(`^${HINT_COOKIE}=1;`));
		expect(hint).toMatch(/Secure/);
		expect(hint).toMatch(/SameSite=Lax/);
		expect(hint).not.toMatch(/HttpOnly/);
	});

	it("is cleared by logout", async () => {
		const { cookie } = await harness.signIn();
		const res = await request(harness.app)
			.post("/auth/logout")
			.set("cookie", `${cookie}; ${HINT_COOKIE}=1`)
			.set("origin", PUBLIC_URL)
			.type("form")
			.send("");
		expect(res.status).toBe(303);
		expect(setCookie(res, HINT_COOKIE)).toMatch(
			new RegExp(`^${HINT_COOKIE}=;`),
		);
	});
});
