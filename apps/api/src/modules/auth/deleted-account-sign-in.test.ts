import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import {
	DeletedAccountModel,
	subHashOf,
} from "../account-deletion/deleted-account-model.js";
import { UserModel } from "../users/user-model.js";
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

const deleteAccount = (cookie: string, dryRun = false) =>
	request(harness.app)
		.delete(`/api/v1/users/me${dryRun ? "?dryRun=true" : ""}`)
		.set("cookie", cookie)
		.set("origin", PUBLIC_URL)
		.send(dryRun ? {} : { confirm: harness.account.username });

/** A sign-in that may stop before a session (unlike `harness.signIn`). */
async function callbackOf(query: Record<string, string> = {}) {
	const start = await request(harness.app).get("/auth/login").query(query);
	const { stoppedAt } = await new TestBrowser().navigate(
		start.headers.location,
		`${PUBLIC_URL}/auth/callback`,
	);
	if (!stoppedAt) throw new Error("the IdP did not return to Localman");
	return request(harness.app)
		.get(`${stoppedAt.pathname}${stoppedAt.search}`)
		.set("cookie", cookieFrom(start, LOGIN_COOKIE) ?? "");
}

const cleared = (res: request.Response, name: string) =>
	setCookies(res).some(
		(cookie) =>
			cookie.startsWith(`${name}=;`) && /Expires=Thu, 01 Jan 1970/.test(cookie),
	);

describe("signing in after the Localman account was deleted", () => {
	it("clears the cookies, asks before making a new account, and gives it no second period", async () => {
		const { cookie } = await harness.signIn();
		const sub = harness.account.sub;
		expect(
			(await UserModel.findOne({ sub }).lean())?.trialStartedAt,
		).toBeTruthy();

		const preview = await deleteAccount(cookie, true);
		expect(preview.status).toBe(200);
		expect(cleared(preview, SESSION_COOKIE)).toBe(false);
		const deleted = await deleteAccount(cookie);
		expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
		expect(cleared(deleted, SESSION_COOKIE)).toBe(true);
		expect(cleared(deleted, HINT_COOKIE)).toBe(true);

		// Only a hash of the subject is kept.
		const rows = await DeletedAccountModel.find().lean();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.subHash).toBe(subHashOf(sub));
		expect(JSON.stringify(rows)).not.toContain(sub);

		// A 401 elsewhere sends the browser through sign-in: it stops at the
		// choice instead of quietly making a new account.
		const refused = await callbackOf();
		expect(refused.status).toBe(303);
		expect(refused.headers.location).toBe("/?authError=account_deleted");
		expect(cookieFrom(refused, SESSION_COOKIE)).toBeUndefined();
		expect(cleared(refused, HINT_COOKIE)).toBe(true);
		expect(await UserModel.exists({ sub })).toBeNull();
		// A silent sign-in makes no account either.
		const silent = await callbackOf({ prompt: "none" });
		expect(cookieFrom(silent, SESSION_COOKIE)).toBeUndefined();
		expect(await UserModel.exists({ sub })).toBeNull();

		// "Create a new account": a fresh, empty account without a new period.
		const again = await harness.signIn({ recreate: "1" });
		expect(again.callback.headers.location).toBe("/projects");
		const user = await UserModel.findOne({ sub }).lean();
		expect(user?.plan).toBe("free");
		expect(user?.trialStartedAt).toBeUndefined();
		// From then on sign-in is ordinary.
		expect((await harness.signIn()).cookie).toBeTruthy();
	});
});
