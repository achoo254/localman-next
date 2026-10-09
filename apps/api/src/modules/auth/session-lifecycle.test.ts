import { decodeJwt } from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import { SessionModel } from "./session-model.js";
import { type AuthHarness, startAuthHarness } from "./testing/auth-harness.js";
import { formField } from "./testing/test-browser.js";
import { TUNNEL_RESOURCE } from "./token-exchange.js";

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

function me(cookie: string) {
	return request(harness.app).get("/api/v1/users/me").set("cookie", cookie);
}

async function expireAccessToken(): Promise<void> {
	await SessionModel.updateMany(
		{},
		{ accessTokenExpiresAt: new Date(Date.now() - 1000) },
	);
}

async function storedSession() {
	const session = await SessionModel.findOne().lean();
	if (!session) throw new Error("no session");
	return session;
}

describe("silent refresh", () => {
	it("refreshes an expired access token without the user noticing", async () => {
		const { cookie } = await harness.signIn();
		const before = await storedSession();
		await expireAccessToken();
		const refreshes = harness.idp.refreshCount();

		const res = await me(cookie);
		expect(res.status).toBe(200);
		expect(res.headers["set-cookie"]).toBeUndefined();
		expect(harness.idp.refreshCount()).toBe(refreshes + 1);
		const after = await storedSession();
		expect(after.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
		expect(after.tokens).not.toBe(before.tokens);
		expect(after.refreshLockedUntil).toBeUndefined();
	});

	it("refreshes once for concurrent requests (rotation never replays)", async () => {
		const { cookie } = await harness.signIn();
		await expireAccessToken();
		const refreshes = harness.idp.refreshCount();
		const results = await Promise.all(
			Array.from({ length: 6 }, () => me(cookie)),
		);
		expect(results.map((r) => r.status)).toEqual(Array(6).fill(200));
		expect(harness.idp.refreshCount()).toBe(refreshes + 1);

		// The rotated token still works: the grant was not revoked by a replay.
		await expireAccessToken();
		expect((await me(cookie)).status).toBe(200);
		expect(harness.idp.refreshCount()).toBe(refreshes + 2);
	});

	it("re-reads userinfo at refresh so a relinked Telegram chat is picked up", async () => {
		const { cookie } = await harness.signIn();
		harness.account.telegram = undefined;
		await expireAccessToken();
		const res = await me(cookie);
		expect(res.body.telegram).toEqual({ linked: false, username: null });
	});

	it("ends the session when the IdP refuses the refresh token", async () => {
		const { cookie } = await harness.signIn();
		const session = await harness.auth.sessions.findById(
			(await storedSession())._id,
		);
		const refreshToken = session?.tokens.refreshToken ?? "";
		const stored = await harness.idp.provider.RefreshToken.find(refreshToken);
		const grant = stored?.grantId
			? await harness.idp.provider.Grant.find(stored.grantId)
			: undefined;
		await grant?.destroy();
		await expireAccessToken();
		expect((await me(cookie)).status).toBe(401);
		expect(await SessionModel.countDocuments()).toBe(0);
	});
});

describe("back-channel logout from the IdP", () => {
	it("ends the Localman session when the user signs out at the IdP", async () => {
		const { cookie, browser } = await harness.signIn();
		expect((await me(cookie)).status).toBe(200);

		const page = await browser.request(`${harness.issuer}/session/end`);
		const xsrf = formField(await page.text(), "xsrf");
		await browser.navigate(
			`${harness.issuer}/session/end/confirm`,
			"https://never/",
			{
				xsrf,
				logout: "yes",
			},
		);
		const res = await me(cookie);
		expect(res.status).toBe(401);
		expect(await SessionModel.countDocuments()).toBe(0);
	});
});

describe("token exchange to Tunelo", () => {
	it("trades the session for a cached tunnels:read token with aud Tunelo", async () => {
		await harness.signIn();
		const sessionId = (await storedSession())._id;
		const token = await harness.auth.tunnelTokens.accessTokenFor(sessionId);
		const claims = decodeJwt(token);
		expect(claims.aud).toBe(TUNNEL_RESOURCE);
		expect(claims.scope).toBe("tunnels:read");
		expect(claims.sub).toBe("acc_test_1");
		expect(await harness.auth.tunnelTokens.accessTokenFor(sessionId)).toBe(
			token,
		);

		// A cached token is not served once its session has ended.
		await harness.auth.sessions.destroyById(sessionId);
		await expect(
			harness.auth.tunnelTokens.accessTokenFor(sessionId),
		).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
	});

	it("treats a dead subject token as a dead session", async () => {
		await harness.signIn();
		const stored = await storedSession();
		const session = await harness.auth.sessions.findById(stored._id);
		const access = await harness.idp.provider.AccessToken.find(
			session?.tokens.accessToken ?? "",
		);
		await access?.destroy();
		await expect(
			harness.auth.tunnelTokens.accessTokenFor(stored._id),
		).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
		expect(await SessionModel.countDocuments()).toBe(0);
	});
});
