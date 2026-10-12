import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "vitest";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import { WebSessionModel } from "../web-session-model.js";
import { type WebHarness, startWebHarness } from "./web-harness.js";

useTestDatabase("web-session-refresh");

let harness: WebHarness;

beforeAll(async () => {
	harness = await startWebHarness();
});

afterAll(() => harness.close());

beforeEach(async () => {
	await WebSessionModel.deleteMany({});
	harness.idp.refreshCount = 0;
	harness.idp.refreshDelayMs = 0;
	harness.idp.tokenFailureStatus = null;
});

/** Makes the stored access token look expired, so the next request refreshes. */
async function expireAccessToken(agoMs = 1000): Promise<void> {
	await WebSessionModel.updateMany(
		{},
		{ $set: { accessExp: new Date(Date.now() - agoMs) } },
	);
}

const SIGNED_IN = 'action="/auth/logout"';

test("a fresh access token needs no refresh", async () => {
	const cookie = await harness.signIn();
	const page = await harness.request("/", { cookie });
	expect(page.body).toContain(SIGNED_IN);
	expect(harness.idp.refreshCount).toBe(0);
});

test("an expired access token is refreshed and the rotated token stored", async () => {
	const cookie = await harness.signIn();
	const before = await WebSessionModel.findOne().lean();
	await expireAccessToken();

	const page = await harness.request("/", { cookie });
	expect(page.body).toContain(SIGNED_IN);
	expect(harness.idp.refreshCount).toBe(1);
	const after = await WebSessionModel.findOne().lean();
	expect(after?.refreshEnc).not.toBe(before?.refreshEnc);
	expect(after?.accessExp.getTime()).toBeGreaterThan(Date.now());
	// Never past 90 days from sign-in.
	expect(after?.expiresAt.getTime()).toBeLessThanOrEqual(
		(after?.loginAt.getTime() ?? 0) + 90 * 24 * 60 * 60 * 1000,
	);
});

test("concurrent requests of one session share a single refresh", async () => {
	const cookie = await harness.signIn();
	await expireAccessToken();
	harness.idp.refreshDelayMs = 150;

	const pages = await Promise.all(
		Array.from({ length: 4 }, () => harness.request("/", { cookie })),
	);
	for (const page of pages) expect(page.body).toContain(SIGNED_IN);
	expect(harness.idp.refreshCount).toBe(1);
	expect(await WebSessionModel.countDocuments()).toBe(1);

	// Afterwards the rotated token still works: no replay happened.
	await expireAccessToken();
	harness.idp.refreshDelayMs = 0;
	const next = await harness.request("/", { cookie });
	expect(next.body).toContain(SIGNED_IN);
	expect(harness.idp.refreshCount).toBe(2);
});

test("a grant revoked at the IdP ends the session (invalid_grant)", async () => {
	const cookie = await harness.signIn();
	harness.idp.revokeAllGrants();
	await expireAccessToken();

	const page = await harness.request("/", { cookie });
	expect(page.status).toBe(200);
	expect(page.body).not.toContain(SIGNED_IN);
	expect(page.body).toContain('href="/auth/login"');
	expect(await WebSessionModel.countDocuments()).toBe(0);
	expect(harness.logs()).toContain("Web session ended at the IdP");
});

test("an expired session is signed out even before MongoDB's TTL sweep", async () => {
	const cookie = await harness.signIn();
	await WebSessionModel.updateMany(
		{},
		{ $set: { expiresAt: new Date(Date.now() - 1000) } },
	);
	const page = await harness.request("/", { cookie });
	expect(page.body).not.toContain(SIGNED_IN);
});

test("a forged or unknown session cookie reads as signed out", async () => {
	for (const value of ["a".repeat(43), "not-a-session", ""]) {
		const page = await harness.request("/", {
			cookie: `__Host-tunelo_session=${value}`,
		});
		expect(page.status).toBe(200);
		expect(page.body).not.toContain(SIGNED_IN);
		if (value) expect(page.cookies.get("__Host-tunelo_session")).toBe("");
	}
});

describe("a refresh failing for a transient reason (IdP 503)", () => {
	test("keeps the session within an hour past the access token's expiry", async () => {
		const cookie = await harness.signIn();
		harness.idp.tokenFailureStatus = 503;
		await expireAccessToken(30 * 60 * 1000);
		const page = await harness.request("/", { cookie });
		expect(page.body).toContain(SIGNED_IN);
		expect(await WebSessionModel.countDocuments()).toBe(1);
		expect(harness.logs()).toContain("Web session refresh failed");
	});

	test("signs out beyond that hour and deletes the session", async () => {
		const cookie = await harness.signIn();
		harness.idp.tokenFailureStatus = 503;
		await expireAccessToken(2 * 60 * 60 * 1000);
		const page = await harness.request("/", { cookie });
		expect(page.body).not.toContain(SIGNED_IN);
		expect(page.body).toContain('href="/auth/login"');
		expect(await WebSessionModel.countDocuments()).toBe(0);
	});
});
