import { randomBytes } from "node:crypto";
import request, { type Response } from "supertest";
import type { MobileAppSettings } from "../app-link-association.js";
import { pkceChallengeOf } from "../mobile-handoff-model.js";
import {
	type AuthHarness,
	LOGIN_COOKIE,
	PUBLIC_URL,
	cookieFrom,
} from "./auth-harness.js";
import { TestBrowser } from "./test-browser.js";

/** TEST ONLY. Both platforms configured, as in production. */
export const TEST_MOBILE_APPS: MobileAppSettings = {
	iosTeamId: "AM5C55N339",
	androidCertSha256: [Array.from({ length: 32 }, () => "AB").join(":")],
};

export interface MobileStart {
	readonly verifier: string;
	readonly appState: string;
	/** The confirmation page (the IdP callback's answer). */
	readonly callback: Response;
	/** The handoff code from the page's form. */
	readonly code: string;
}

export interface MobileSignIn extends MobileStart {
	/** Continue: 303 to `/m/auth/callback?code&state`. */
	readonly confirm: Response;
}

/**
 * TEST ONLY. The app's `/auth/login?client=mobile` through the IdP to
 * the confirmation page. `cookie` is sent along with the login cookie at
 * the callback (a web session of the same browser).
 */
export async function startMobileSignIn(
	harness: AuthHarness,
	options: {
		readonly query?: Record<string, string>;
		readonly cookie?: string;
	} = {},
): Promise<MobileStart> {
	const verifier = randomBytes(48).toString("base64url");
	const appState = randomBytes(16).toString("base64url");
	const start = await request(harness.app)
		.get("/auth/login")
		.query({
			client: "mobile",
			state: appState,
			code_challenge: pkceChallengeOf(verifier),
			code_challenge_method: "S256",
			...options.query,
		});
	if (start.status !== 303) throw new Error(`login: ${start.status}`);
	const browser = new TestBrowser();
	const { stoppedAt } = await browser.navigate(
		start.headers.location,
		`${PUBLIC_URL}/auth/callback`,
	);
	if (!stoppedAt) throw new Error("the IdP did not return to Localman");
	const cookies = [cookieFrom(start, LOGIN_COOKIE), options.cookie];
	const callback = await request(harness.app)
		.get(`${stoppedAt.pathname}${stoppedAt.search}`)
		.set("cookie", cookies.filter(Boolean).join("; "));
	const code = /name="code" value="([^"]+)"/.exec(callback.text)?.[1];
	if (!code) throw new Error(`callback: ${callback.status}`);
	return { verifier, appState, callback, code };
}

/** The form of the confirmation page, as the browser posts it. */
export function postConfirm(
	harness: AuthHarness,
	code: string,
	action: "continue" | "cancel",
): Promise<Response> {
	return request(harness.app)
		.post("/auth/mobile/confirm")
		.set("origin", PUBLIC_URL)
		.type("form")
		.send({ code, action });
}

/** TEST ONLY. Start, then Continue on the confirmation page. */
export async function mobileSignIn(
	harness: AuthHarness,
	options: {
		readonly query?: Record<string, string>;
		readonly cookie?: string;
	} = {},
): Promise<MobileSignIn> {
	const started = await startMobileSignIn(harness, options);
	const confirm = await postConfirm(harness, started.code, "continue");
	return { ...started, confirm };
}

/** `POST /auth/mobile/token` as the app sends it (no Origin, no cookie). */
export function redeem(
	harness: AuthHarness,
	code: string,
	verifier: string,
): Promise<Response> {
	return request(harness.app)
		.post("/auth/mobile/token")
		.send({ code, code_verifier: verifier });
}

/** A signed-in app: its Bearer token. */
export async function mobileToken(harness: AuthHarness): Promise<string> {
	const { code, verifier } = await mobileSignIn(harness);
	const res = await redeem(harness, code, verifier);
	const token: unknown = res.body.token;
	if (res.status !== 200 || typeof token !== "string") {
		throw new Error(`token: ${res.status}`);
	}
	return token;
}
