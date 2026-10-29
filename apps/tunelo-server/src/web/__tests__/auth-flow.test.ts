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
import {
	AUTH_COOKIE,
	PUBLIC_URL,
	SESSION_COOKIE,
	type WebHarness,
	startWebHarness,
} from "./web-harness.js";

useTestDatabase("web-auth-flow");

let harness: WebHarness;

beforeAll(async () => {
	harness = await startWebHarness();
});

afterAll(() => harness.close());

beforeEach(async () => {
	await WebSessionModel.deleteMany({});
	harness.idp.account.userinfo = {};
});

/** The CSRF token the signed-in page puts in the sign-out form. */
async function csrfOf(cookie: string): Promise<string> {
	const page = await harness.request("/", { cookie });
	const token = /name="csrf" value="([^"]+)"/.exec(page.body)?.[1];
	if (!token) throw new Error("no CSRF token on the page");
	return token;
}

describe("sign-in", () => {
	test("redirects to the IdP with PKCE S256, state and nonce, no API scope", async () => {
		const res = await harness.request("/auth/login", {
			headers: { "accept-language": "vi-VN,vi;q=0.9" },
		});
		expect(res.status).toBe(303);
		expect(res.headers["cache-control"]).toBe("no-store");
		const target = new URL(res.headers.location ?? "");
		expect(target.origin).toBe(harness.idp.issuer);
		const params = target.searchParams;
		expect(params.get("client_id")).toBe("tunelo-web");
		expect(params.get("redirect_uri")).toBe(`${PUBLIC_URL}/auth/callback`);
		// No offline_access: refresh tokens live with the IdP session.
		expect(params.get("scope")).toBe("openid profile email");
		expect(params.has("prompt")).toBe(false);
		// No resource: the IdP issues an opaque token, usable at userinfo only.
		expect(params.has("resource")).toBe(false);
		expect(params.get("code_challenge_method")).toBe("S256");
		expect(params.get("ui_locales")).toBe("vi");
		for (const name of ["code_challenge", "state", "nonce"]) {
			expect(params.get(name)).toMatch(/^[\w-]{20,}$/);
		}
		const auth = res.setCookies.find((c) => c.startsWith(`${AUTH_COOKIE}=`));
		expect(auth).toMatch(/; Path=\/;/);
		expect(auth).toMatch(/HttpOnly/);
		expect(auth).toMatch(/Secure/);
		expect(auth).toMatch(/SameSite=Lax/);
		expect(auth).not.toMatch(/Domain=/i);
		// The sealed cookie reveals neither the state nor the verifier.
		expect(auth).not.toContain(params.get("state"));
	});

	test("the callback opens a __Host- session and lands on the tunnel list", async () => {
		const cookie = await harness.signIn();
		const stored = await WebSessionModel.findOne().lean();
		expect(stored?.sub).toBe("acc_alice");
		expect(stored?.sid).toBe("sid-alice-1");
		expect(stored?._id).toMatch(/^[a-f0-9]{64}$/);
		expect(stored?.refreshEnc).toMatch(/^v1\./);
		expect(JSON.stringify(stored)).not.toContain(cookie.split("=")[1]);

		const page = await harness.request("/", { cookie });
		expect(page.status).toBe(200);
		expect(page.headers["cache-control"]).toBe("no-store");
		expect(page.body).toContain('action="/auth/logout"');
	});

	test("session cookie flags", async () => {
		const start = await harness.request("/auth/login");
		const back = await harness.idp.authorize(start.headers.location ?? "");
		const callback = await harness.request(`${back.pathname}${back.search}`, {
			cookie: `${AUTH_COOKIE}=${start.cookies.get(AUTH_COOKIE)}`,
		});
		expect(callback.headers.location).toBe("/");
		const session = callback.setCookies.find((c) =>
			c.startsWith(`${SESSION_COOKIE}=`),
		);
		expect(session).toMatch(/; Path=\/;/);
		expect(session).toMatch(/HttpOnly/);
		expect(session).toMatch(/Secure/);
		expect(session).toMatch(/SameSite=Lax/);
		expect(session).not.toMatch(/Domain=/i);
		// The one-off sign-in cookie is cleared.
		expect(callback.cookies.get(AUTH_COOKIE)).toBe("");
	});

	test("a callback without the sign-in cookie or with another state is refused", async () => {
		const start = await harness.request("/auth/login");
		const back = await harness.idp.authorize(start.headers.location ?? "");
		const noCookie = await harness.request(`${back.pathname}${back.search}`);
		expect(noCookie.headers.location).toBe("/?error=login_expired");

		back.searchParams.set("state", "forged-state-forged-state");
		const forged = await harness.request(`${back.pathname}${back.search}`, {
			cookie: `${AUTH_COOKIE}=${start.cookies.get(AUTH_COOKIE)}`,
		});
		expect(forged.headers.location).toBe("/?error=login_expired");
		expect(await WebSessionModel.countDocuments()).toBe(0);
	});
});

describe("sign-out", () => {
	test("refuses a POST without the CSRF token and keeps the session", async () => {
		const cookie = await harness.signIn();
		const res = await harness.request("/auth/logout", {
			method: "POST",
			cookie,
			form: { csrf: "wrong" },
		});
		expect(res.status).toBe(303);
		expect(res.headers.location).toBe("/?error=csrf");
		expect(await WebSessionModel.countDocuments()).toBe(1);
	});

	test("deletes the session, revokes the refresh token and ends the IdP session", async () => {
		const cookie = await harness.signIn();
		const res = await harness.request("/auth/logout", {
			method: "POST",
			cookie,
			form: { csrf: await csrfOf(cookie) },
		});
		expect(res.status).toBe(303);
		const target = new URL(res.headers.location ?? "");
		expect(`${target.origin}${target.pathname}`).toBe(
			`${harness.idp.issuer}/session/end`,
		);
		expect(target.searchParams.get("post_logout_redirect_uri")).toBe(
			`${PUBLIC_URL}/`,
		);
		expect(target.searchParams.get("id_token_hint")).toMatch(/^ey/);
		expect(res.cookies.get(SESSION_COOKIE)).toBe("");
		expect(await WebSessionModel.countDocuments()).toBe(0);
		expect(harness.idp.revoked).toHaveLength(1);

		const after = await harness.request("/", { cookie });
		expect(after.body).toContain('href="/auth/login"');
	});
});

test("logs never carry tokens, codes or cookies", async () => {
	const cookie = await harness.signIn();
	await harness.request("/auth/logout", {
		method: "POST",
		cookie,
		form: { csrf: await csrfOf(cookie) },
	});
	const logs = harness.logs();
	expect(logs).toContain("Web session started");
	expect(logs).not.toContain(cookie.split("=")[1]);
	for (const revoked of harness.idp.revoked)
		expect(logs).not.toContain(revoked);
	expect(logs).not.toMatch(/eyJ[\w-]+\.[\w-]+\./);
	expect(logs).not.toContain(harness.idp.clientSecret);
});
