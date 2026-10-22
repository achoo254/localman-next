import { brand } from "@localman/shared/brand";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectTestMongo } from "../../test-support/test-mongo.js";
import { type AuthHarness, startAuthHarness } from "./testing/auth-harness.js";
import { TEST_MOBILE_APPS } from "./testing/mobile-sign-in.js";

let enabled: AuthHarness;
let disabled: AuthHarness;
let teardownMongo: () => Promise<void>;

beforeAll(async () => {
	teardownMongo = await connectTestMongo();
	enabled = await startAuthHarness({ mobile: TEST_MOBILE_APPS });
	disabled = await startAuthHarness();
});

afterAll(async () => {
	await enabled?.close();
	await disabled?.close();
	await teardownMongo?.();
});

describe("app association files", () => {
	it("associates the iOS app with the callback (applinks) and the host (webcredentials)", async () => {
		const res = await request(enabled.app).get(
			"/.well-known/apple-app-site-association",
		);
		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toMatch(/^application\/json/);
		const appId = `${TEST_MOBILE_APPS.iosTeamId}.${brand.appIds.ios}`;
		expect(res.body).toEqual({
			applinks: {
				details: [
					{ appIDs: [appId], components: [{ "/": "/m/auth/callback" }] },
				],
			},
			webcredentials: { apps: [appId] },
		});
	});

	it("associates the Android app by its certificate fingerprints", async () => {
		const res = await request(enabled.app).get("/.well-known/assetlinks.json");
		expect(res.status).toBe(200);
		expect(res.body).toEqual([
			{
				relation: [
					"delegate_permission/common.handle_all_urls",
					"delegate_permission/common.get_login_creds",
				],
				target: {
					namespace: "android_app",
					package_name: brand.appIds.android,
					sha256_cert_fingerprints: TEST_MOBILE_APPS.androidCertSha256,
				},
			},
		]);
	});

	it("serves the callback's fallback page when no app took the link", async () => {
		const res = await request(enabled.app)
			.get("/m/auth/callback?error=access_denied&state=abc")
			.set("accept-language", "zh-CN,zh;q=0.9");
		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toMatch(/^text\/html/);
		expect(res.headers["content-security-policy"]).toMatch(
			/frame-ancestors 'none'/,
		);
		expect(res.headers["referrer-policy"]).toBe("no-referrer");
		expect(res.text).toContain('lang="zh-CN"');
	});
});

describe("mobile sign-in without configured apps", () => {
	it("answers 404 for both files and the token endpoint", async () => {
		for (const path of [
			"/.well-known/apple-app-site-association",
			"/.well-known/assetlinks.json",
		]) {
			expect((await request(disabled.app).get(path)).status, path).toBe(404);
		}
		const token = await request(disabled.app)
			.post("/auth/mobile/token")
			.send({ code: "c".repeat(43), code_verifier: "v".repeat(43) });
		expect(token.status).toBe(404);
	});

	it("sends client=mobile back to the app instead of the IdP", async () => {
		const state = "s".repeat(22);
		const res = await request(disabled.app)
			.get("/auth/login")
			.query({
				client: "mobile",
				state,
				code_challenge: "c".repeat(43),
			});
		expect(res.status).toBe(303);
		expect(res.headers.location).toBe(
			`/m/auth/callback?error=mobile_unavailable&state=${state}`,
		);
	});
});
