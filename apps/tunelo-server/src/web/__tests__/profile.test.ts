import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import { WebSessionModel } from "../web-session-model.js";
import { type WebHarness, startWebHarness } from "./web-harness.js";

useTestDatabase("web-profile");

let harness: WebHarness;

beforeAll(async () => {
	harness = await startWebHarness();
});

afterAll(() => harness.close());

beforeEach(async () => {
	await WebSessionModel.deleteMany({});
	harness.idp.account.userinfo = {};
	harness.idp.userinfoFails = false;
	harness.idp.userinfoCount = 0;
});

const TOP_BAR_USER = /data-id="topbar-user">([^<]*)</;

/** The top-bar account label of `/` for a session, in one language. */
async function topBarUser(
	cookie: string,
	locale = "en",
): Promise<string | null> {
	const page = await harness.request("/", {
		cookie: `${cookie}; tunelo_lang=${locale}`,
	});
	expect(page.body).toContain('action="/auth/logout"');
	return TOP_BAR_USER.exec(page.body)?.[1] ?? null;
}

test("the name comes from userinfo at sign-in and shows in all three languages", async () => {
	harness.idp.account.userinfo = {
		preferred_username: "alice",
		name: "Alice Nguyễn",
	};
	const cookie = await harness.signIn();
	expect(harness.idp.userinfoCount).toBe(1);
	const stored = await WebSessionModel.findOne().lean();
	expect(stored?.profile).toEqual({ username: "alice", name: "Alice Nguyễn" });

	expect(await topBarUser(cookie, "en")).toBe("Signed in as Alice Nguyễn");
	expect(await topBarUser(cookie, "zh-CN")).toBe("已登录：Alice Nguyễn");
	expect(await topBarUser(cookie, "vi")).toBe("Đã đăng nhập: Alice Nguyễn");
});

test("falls back to the username, and escapes what the IdP sends", async () => {
	harness.idp.account.userinfo = { preferred_username: "<b>alice</b>" };
	const cookie = await harness.signIn();
	expect(await topBarUser(cookie)).toBe(
		"Signed in as &lt;b&gt;alice&lt;/b&gt;",
	);
});

test("without profile claims the top bar shows only the sign-out button", async () => {
	const cookie = await harness.signIn();
	expect(await topBarUser(cookie)).toBeNull();
});

test("a failing userinfo still signs in, without a name", async () => {
	harness.idp.userinfoFails = true;
	const cookie = await harness.signIn();
	expect(await topBarUser(cookie)).toBeNull();
	expect(harness.logs()).toContain("Userinfo at sign-in failed");
});

test("refreshes keep the profile and do not call userinfo again", async () => {
	harness.idp.account.userinfo = { name: "Alice" };
	const cookie = await harness.signIn();
	await WebSessionModel.updateMany(
		{},
		{ $set: { accessExp: new Date(Date.now() - 1000) } },
	);
	expect(await topBarUser(cookie)).toBe("Signed in as Alice");
	expect(harness.idp.refreshCount).toBeGreaterThan(0);
	expect(harness.idp.userinfoCount).toBe(1);
});

test("the profile never reaches the logs", async () => {
	harness.idp.account.userinfo = {
		preferred_username: "secret-handle-42",
		name: "Very Private Name",
	};
	await harness.signIn();
	const logs = harness.logs();
	expect(logs).toContain("Web session started");
	expect(logs).not.toContain("secret-handle-42");
	expect(logs).not.toContain("Very Private Name");
});
