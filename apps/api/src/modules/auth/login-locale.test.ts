import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectTestMongo } from "../../test-support/test-mongo.js";
import { type AuthHarness, startAuthHarness } from "./testing/auth-harness.js";

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

async function uiLocalesFor(query: string): Promise<string | null> {
	const res = await request(harness.app).get(`/auth/login${query}`);
	expect(res.status).toBe(303);
	return new URL(res.headers.location).searchParams.get("ui_locales");
}

describe("sign-in language", () => {
	it("sends the web language to the IdP as ui_locales", async () => {
		expect(await uiLocalesFor("?locale=zh-CN")).toBe("zh-CN");
		expect(await uiLocalesFor("?locale=vi&returnTo=%2Fprojects")).toBe("vi");
		expect(await uiLocalesFor("?locale=en")).toBe("en");
	});

	it("leaves ui_locales out unless the value is a supported locale", async () => {
		for (const query of [
			"",
			"?locale=fr",
			"?locale=zh-cn",
			"?locale=vi%20en",
			"?locale=vi&locale=en",
			"?locale[]=vi",
		]) {
			expect(await uiLocalesFor(query), query).toBeNull();
		}
	});
});
