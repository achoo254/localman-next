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

const MENU_NAME = /<span class="shell-account-name">([^<]*)</;
const AVATAR = /<img class="shell-avatar" src="([^"]*)"/;

/** The account menu of `/` for a session, in one language. */
async function accountMenu(
	cookie: string,
	locale = "en",
): Promise<{ name: string | null; picture: string | null; body: string }> {
	const page = await harness.request("/", {
		cookie: `${cookie}; hd_lang=${locale}`,
	});
	expect(page.body).toContain('data-id="account-menu"');
	expect(page.body).toContain('action="/auth/logout"');
	return {
		name: MENU_NAME.exec(page.body)?.[1] ?? null,
		picture: AVATAR.exec(page.body)?.[1] ?? null,
		body: page.body,
	};
}

test("name, email and picture come from userinfo at sign-in and show in the account menu", async () => {
	harness.idp.account.userinfo = {
		preferred_username: "alice",
		name: "Alice Nguyễn",
		email: "alice@example.com",
		picture: "https://lh3.googleusercontent.com/a/alice",
	};
	const cookie = await harness.signIn();
	expect(harness.idp.userinfoCount).toBe(1);
	const stored = await WebSessionModel.findOne().lean();
	expect(stored?.profile).toEqual({
		username: "alice",
		name: "Alice Nguyễn",
		email: "alice@example.com",
		picture: "https://lh3.googleusercontent.com/a/alice",
	});

	for (const locale of ["en", "zh-CN", "vi"]) {
		const menu = await accountMenu(cookie, locale);
		expect(menu.name).toBe("Alice Nguyễn");
		expect(menu.picture).toBe("https://lh3.googleusercontent.com/a/alice");
		expect(menu.body).toContain(
			'<span class="shell-account-head-email">alice@example.com</span>',
		);
	}
	const vi = await accountMenu(cookie, "vi");
	expect(vi.body).toContain("Đăng xuất");
	expect(vi.body).toContain(
		`href="${harness.idp.issuer}/account#account-sign-in"`,
	);
});

test("falls back to the username, and escapes what the IdP sends", async () => {
	harness.idp.account.userinfo = {
		preferred_username: "<b>alice</b>",
		picture: 'https://avatars.githubusercontent.com/u/1?"x',
	};
	const cookie = await harness.signIn();
	const menu = await accountMenu(cookie);
	expect(menu.name).toBe("&lt;b&gt;alice&lt;/b&gt;");
	expect(menu.picture).toBe(
		"https://avatars.githubusercontent.com/u/1?&quot;x",
	);
});

test("a picture that is not https is not shown: the initial is", async () => {
	harness.idp.account.userinfo = {
		name: "Alice",
		picture: "http://example.com/alice.png",
	};
	const cookie = await harness.signIn();
	const menu = await accountMenu(cookie);
	expect(menu.picture).toBeNull();
	expect(menu.body).toContain('data-initial="A"');
});

test("without profile claims the menu says Account", async () => {
	const cookie = await harness.signIn();
	expect((await accountMenu(cookie)).name).toBe("Account");
});

test("a failing userinfo still signs in, without a name", async () => {
	harness.idp.userinfoFails = true;
	const cookie = await harness.signIn();
	expect((await accountMenu(cookie)).name).toBe("Account");
	expect(harness.logs()).toContain("Userinfo at sign-in failed");
});

test("refreshes keep the profile and do not call userinfo again", async () => {
	harness.idp.account.userinfo = { name: "Alice" };
	const cookie = await harness.signIn();
	await WebSessionModel.updateMany(
		{},
		{ $set: { accessExp: new Date(Date.now() - 1000) } },
	);
	expect((await accountMenu(cookie)).name).toBe("Alice");
	expect(harness.idp.refreshCount).toBeGreaterThan(0);
	expect(harness.idp.userinfoCount).toBe(1);
});

test("the profile never reaches the logs", async () => {
	harness.idp.account.userinfo = {
		preferred_username: "secret-handle-42",
		name: "Very Private Name",
		email: "private@example.com",
		picture: "https://lh3.googleusercontent.com/a/private-picture",
	};
	await harness.signIn();
	const logs = harness.logs();
	expect(logs).toContain("Web session started");
	for (const value of [
		"secret-handle-42",
		"Very Private Name",
		"private@example.com",
		"private-picture",
	]) {
		expect(logs).not.toContain(value);
	}
});
