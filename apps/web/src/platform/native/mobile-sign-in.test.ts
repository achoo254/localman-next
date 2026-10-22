import { describe, expect, it } from "vitest";
import { pkceChallenge, randomUrlSafe, readCallback } from "./mobile-sign-in";

const CALLBACK = "https://localman.hoandat.com/m/auth/callback";

describe("readCallback", () => {
	it("takes the code when the state matches", () => {
		expect(readCallback(`${CALLBACK}?code=abc&state=s1`, "s1")).toEqual({
			code: "abc",
		});
	});

	it("refuses a callback for another sign-in", () => {
		expect(readCallback(`${CALLBACK}?code=abc&state=other`, "s1")).toEqual({
			error: "login_failed",
		});
		expect(readCallback(`${CALLBACK}?code=abc`, "s1")).toEqual({
			error: "login_failed",
		});
	});

	it("passes on the reasons the web explains, others as a failure", () => {
		expect(
			readCallback(`${CALLBACK}?error=access_denied&state=s1`, "s1"),
		).toEqual({ error: "access_denied" });
		expect(
			readCallback(`${CALLBACK}?error=rate_limited&state=s1`, "s1"),
		).toEqual({ error: "rate_limited" });
		expect(
			readCallback(`${CALLBACK}?error=account_deleted&state=s1`, "s1"),
		).toEqual({ error: "account_deleted" });
		expect(
			readCallback(`${CALLBACK}?error=server_error&code=abc&state=s1`, "s1"),
		).toEqual({ error: "login_failed" });
	});
});

describe("PKCE", () => {
	it("makes URL-safe verifiers of the RFC 7636 length", () => {
		const verifier = randomUrlSafe(32);
		expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(randomUrlSafe(32)).not.toBe(verifier);
	});

	it("derives the S256 challenge of RFC 7636 appendix B", async () => {
		await expect(
			pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
		).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
	});
});
