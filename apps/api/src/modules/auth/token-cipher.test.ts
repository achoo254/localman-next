import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TokenCipher, TokenCipherError, parseKeyring } from "./token-cipher.js";

const key = () => randomBytes(32).toString("base64");

describe("parseKeyring", () => {
	it("makes the first key active and keeps the others for decryption", () => {
		const ring = parseKeyring(`k2:${key()}, k1:${key()}`);
		expect(ring?.activeKid).toBe("k2");
		expect([...(ring?.keys.keys() ?? [])]).toEqual(["k2", "k1"]);
	});

	it.each([
		"",
		"nokid",
		`:${key()}`,
		`k1:${randomBytes(16).toString("base64")}`,
		`k1:${key()},k1:${key()}`,
		`bad kid:${key()}`,
		"k1:not base64!",
	])("rejects %j", (value) => {
		expect(parseKeyring(value)).toBeNull();
	});
});

describe("TokenCipher", () => {
	it("round-trips and binds the ciphertext to its record", () => {
		const ring = parseKeyring(`k1:${key()}`);
		if (!ring) throw new Error("keyring");
		const cipher = new TokenCipher(ring);
		const sealed = cipher.encrypt("refresh-token-value", "session-a");
		expect(sealed).toMatch(/^v1\.k1\./);
		expect(sealed).not.toContain("refresh-token-value");
		expect(cipher.decrypt(sealed, "session-a")).toBe("refresh-token-value");
		expect(() => cipher.decrypt(sealed, "session-b")).toThrow(TokenCipherError);
		const tampered = `${sealed.slice(0, -2)}AA`;
		expect(() => cipher.decrypt(tampered, "session-a")).toThrow(
			TokenCipherError,
		);
	});

	it("decrypts with a retired key after rotation, encrypts with the new one", () => {
		const oldKey = key();
		const before = parseKeyring(`k1:${oldKey}`);
		const after = parseKeyring(`k2:${key()},k1:${oldKey}`);
		if (!before || !after) throw new Error("keyring");
		const sealed = new TokenCipher(before).encrypt("secret", "id");
		const rotated = new TokenCipher(after);
		expect(rotated.decrypt(sealed, "id")).toBe("secret");
		expect(rotated.encrypt("secret", "id")).toMatch(/^v1\.k2\./);
		const removed = parseKeyring(`k2:${key()}`);
		if (!removed) throw new Error("keyring");
		expect(() => new TokenCipher(removed).decrypt(sealed, "id")).toThrow(
			/unknown key id/,
		);
	});
});
