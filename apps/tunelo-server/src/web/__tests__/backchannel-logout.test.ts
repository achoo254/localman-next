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

useTestDatabase("web-backchannel-logout");

let harness: WebHarness;

beforeAll(async () => {
	harness = await startWebHarness();
});

afterAll(() => harness.close());

beforeEach(async () => {
	await WebSessionModel.deleteMany({});
	harness.idp.account.sub = "acc_alice";
	harness.idp.account.sid = "sid-alice-1";
});

function post(token: string) {
	return harness.request("/auth/backchannel-logout", {
		method: "POST",
		form: { logout_token: token },
	});
}

test("a valid logout token ends every session of that IdP session only", async () => {
	await harness.signIn();
	await harness.signIn();
	harness.idp.account.sid = "sid-alice-2";
	const other = await harness.signIn();
	expect(await WebSessionModel.countDocuments()).toBe(3);

	const res = await post(await harness.idp.logoutToken({ sid: "sid-alice-1" }));
	expect(res.status).toBe(200);
	expect(await WebSessionModel.countDocuments({ sid: "sid-alice-1" })).toBe(0);
	expect(await WebSessionModel.countDocuments({ sid: "sid-alice-2" })).toBe(1);
	const page = await harness.request("/", { cookie: other });
	expect(page.body).toContain('action="/auth/logout"');
});

test("an unknown sid ends nothing and still answers 200", async () => {
	await harness.signIn();
	const res = await post(await harness.idp.logoutToken({ sid: "sid-unknown" }));
	expect(res.status).toBe(200);
	expect(await WebSessionModel.countDocuments()).toBe(1);
});

test("a sid paired with another account's sub ends nothing", async () => {
	await harness.signIn();
	const res = await post(
		await harness.idp.logoutToken({ sid: "sid-alice-1", sub: "acc_mallory" }),
	);
	expect(res.status).toBe(200);
	expect(await WebSessionModel.countDocuments()).toBe(1);
});

describe("rejected logout tokens (400, nothing ended)", () => {
	const cases: Array<[string, Record<string, unknown>]> = [
		["wrong aud", { aud: "localman-web" }],
		["wrong iss", { iss: "https://evil.example" }],
		["missing events", { events: undefined }],
		["another event", { events: { "urn:example:other": {} } }],
		["missing sid", { sid: undefined }],
		["a nonce (an ID token)", { nonce: "n-123" }],
		["too old", { iat: Math.floor(Date.now() / 1000) - 3600 }],
	];
	test.each(cases)("%s", async (_name, claims) => {
		await harness.signIn();
		const res = await post(await harness.idp.logoutToken(claims));
		expect(res.status).toBe(400);
		expect(await WebSessionModel.countDocuments()).toBe(1);
	});

	test("a token not signed by the IdP", async () => {
		await harness.signIn();
		const token = await harness.idp.logoutToken();
		const [header, payload] = token.split(".");
		const res = await post(`${header}.${payload}.${"A".repeat(86)}`);
		expect(res.status).toBe(400);
		expect(await WebSessionModel.countDocuments()).toBe(1);
	});

	test("no token, or a JSON body", async () => {
		expect((await post("")).status).toBe(400);
		const json = await harness.request("/auth/backchannel-logout", {
			method: "POST",
			headers: { "content-type": "application/json" },
		});
		expect(json.status).toBe(400);
	});
});
