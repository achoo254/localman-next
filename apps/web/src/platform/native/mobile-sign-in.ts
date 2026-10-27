/**
 * Sign-in of the iOS/Android shell (docs/decisions/0005-mobile-session-handoff.md):
 * the system browser runs `/auth/login?client=mobile` (never a WebView), the
 * server ends on a verified https link back into the app carrying a one-time
 * code, and the app redeems it with its PKCE verifier for a session token.
 */
import { type LoginOptions, apiUrl, isSafeReturnPath } from "../../lib/api-url";
import { appConfig } from "../../lib/app-config";
import { saveMobileSession } from "./mobile-session";
import { MOBILE_CALLBACK_PATH } from "./native-build";

/** URL-safe base64 without padding (RFC 7636 §4). */
function base64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export function randomUrlSafe(byteCount: number): string {
	return base64Url(crypto.getRandomValues(new Uint8Array(byteCount)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(verifier),
	);
	return base64Url(new Uint8Array(digest));
}

/** Why a sign-in did not finish, as the web's `?authError=` codes. */
export type MobileSignInError =
	| (typeof EXPLAINED_ERRORS)[number]
	| "login_failed";

/** Server reasons (docs/decisions/0005) the web explains; the rest read as a failure. */
const EXPLAINED_ERRORS = [
	"access_denied",
	"login_expired",
	"rate_limited",
	"account_deleted",
	"idp_unavailable",
] as const;

function isExplained(
	value: string | null,
): value is (typeof EXPLAINED_ERRORS)[number] {
	return EXPLAINED_ERRORS.some((known) => known === value);
}

/** Code and state of the callback, or the error it carries. */
export function readCallback(
	callbackUrl: string,
	expectedState: string,
): { code: string } | { error: MobileSignInError } {
	const url = new URL(callbackUrl);
	const params = url.searchParams;
	const error = params.get("error");
	if (isExplained(error)) return { error };
	const code = params.get("code");
	if (
		error !== null ||
		code === null ||
		params.get("state") !== expectedState
	) {
		return { error: "login_failed" };
	}
	return { code };
}

function isTokenBody(value: unknown): value is { token: string } {
	return (
		typeof value === "object" &&
		value !== null &&
		"token" in value &&
		typeof value.token === "string" &&
		value.token !== ""
	);
}

async function redeem(code: string, verifier: string): Promise<boolean> {
	const response = await fetch(apiUrl("/auth/mobile/token"), {
		method: "POST",
		headers: { Accept: "application/json", "Content-Type": "application/json" },
		body: JSON.stringify({ code, code_verifier: verifier }),
		credentials: "omit",
	});
	const body: unknown = response.ok ? await response.json() : null;
	if (!isTokenBody(body)) return false;
	await saveMobileSession(body.token);
	return true;
}

async function authenticate(
	url: string,
	host: string,
): Promise<string | "cancelled"> {
	const { SystemAuth } = await import("@achoo254/capacitor-system-auth");
	try {
		const result = await SystemAuth.authenticate({
			url,
			callback: { https: { host, path: MOBILE_CALLBACK_PATH } },
		});
		return result.url;
	} catch (cause) {
		const code =
			typeof cause === "object" && cause !== null && "code" in cause
				? cause.code
				: null;
		if (code === "CANCELLED") return "cancelled";
		throw cause;
	}
}

/**
 * Runs the whole sign-in and lands on `returnTo` (or the home page) signed
 * in, or on the home page with `?authError=` explaining why not.
 */
export async function signInOnDevice({
	returnTo,
	prompt,
	locale,
	recreate,
}: LoginOptions = {}): Promise<void> {
	const state = randomUrlSafe(16);
	const verifier = randomUrlSafe(32);
	const login = new URL(apiUrl("/auth/login"));
	login.searchParams.set("client", "mobile");
	login.searchParams.set("state", state);
	login.searchParams.set("code_challenge", await pkceChallenge(verifier));
	login.searchParams.set("code_challenge_method", "S256");
	if (prompt === "create") login.searchParams.set("prompt", prompt);
	if (locale) login.searchParams.set("locale", locale);
	if (recreate) login.searchParams.set("recreate", "1");

	let outcome: MobileSignInError | null = "login_failed";
	try {
		const callback = await authenticate(
			login.href,
			new URL(appConfig.apiBaseUrl).host,
		);
		if (callback === "cancelled") {
			outcome = "access_denied";
		} else {
			const read = readCallback(callback, state);
			outcome =
				"error" in read
					? read.error
					: (await redeem(read.code, verifier))
						? null
						: "login_failed";
		}
	} catch {
		outcome = "login_failed";
	}
	const target = returnTo && isSafeReturnPath(returnTo) ? returnTo : "/";
	window.location.assign(outcome === null ? target : `/?authError=${outcome}`);
}
