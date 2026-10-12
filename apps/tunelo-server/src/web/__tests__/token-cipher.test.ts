import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
	newAuthTransaction,
	openAuthTransaction,
	sealAuthTransaction,
} from "../auth-transaction.js";
import { CsrfTokens } from "../csrf.js";
import { TokenCipher, deriveKey } from "../token-cipher.js";

const key = randomBytes(32);
const cipher = new TokenCipher(key);

describe("TokenCipher", () => {
	test("round-trips and hides the plaintext", () => {
		const sealed = cipher.seal("refresh-token-value", "refresh:abc");
		expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
		expect(sealed).not.toContain("refresh-token-value");
		expect(cipher.open(sealed, "refresh:abc")).toBe("refresh-token-value");
	});

	test("uses a fresh IV each time", () => {
		expect(cipher.seal("same", "aad")).not.toBe(cipher.seal("same", "aad"));
	});

	test("fails closed on another record, a tampered blob or another key", () => {
		const sealed = cipher.seal("secret", "refresh:abc");
		expect(cipher.open(sealed, "refresh:other")).toBeNull();
		const [v, iv, ct, tag] = sealed.split(".");
		const flipped = `${ct?.startsWith("A") ? "B" : "A"}${ct?.slice(1)}`;
		expect(
			cipher.open([v, iv, flipped, tag].join("."), "refresh:abc"),
		).toBeNull();
		expect(cipher.open(`${sealed}.extra`, "refresh:abc")).toBeNull();
		expect(cipher.open("garbage", "refresh:abc")).toBeNull();
		expect(
			new TokenCipher(randomBytes(32)).open(sealed, "refresh:abc"),
		).toBeNull();
	});

	test("needs a 32-byte key", () => {
		expect(() => new TokenCipher(randomBytes(16))).toThrow(/32-byte/);
	});

	test("derives independent keys per purpose", () => {
		expect(deriveKey(key, "cipher").equals(deriveKey(key, "csrf"))).toBe(false);
		expect(deriveKey(key, "csrf")).toHaveLength(32);
	});
});

describe("sign-in transaction cookie", () => {
	test("opens what it sealed, until it expires", () => {
		const now = Date.now();
		const transaction = newAuthTransaction(now);
		const sealed = sealAuthTransaction(cipher, transaction);
		expect(openAuthTransaction(cipher, sealed, now)).toEqual(transaction);
		expect(openAuthTransaction(cipher, sealed, transaction.exp)).toBeNull();
	});

	test("refuses a session blob, a forged value or nothing", () => {
		const other = cipher.seal(
			JSON.stringify(newAuthTransaction()),
			"refresh:x",
		);
		expect(openAuthTransaction(cipher, other)).toBeNull();
		expect(openAuthTransaction(cipher, "v1.a.b.c")).toBeNull();
		expect(openAuthTransaction(cipher, undefined)).toBeNull();
	});
});

describe("CsrfTokens", () => {
	const csrf = new CsrfTokens(deriveKey(key, "csrf"));

	test("accepts the token of the same session only", () => {
		const token = csrf.issue("session-a");
		expect(csrf.verify("session-a", token)).toBe(true);
		expect(csrf.verify("session-b", token)).toBe(false);
		expect(csrf.verify("session-a", `${token}x`)).toBe(false);
		expect(csrf.verify("session-a", undefined)).toBe(false);
		expect(csrf.verify("session-a", ["array"])).toBe(false);
	});
});
