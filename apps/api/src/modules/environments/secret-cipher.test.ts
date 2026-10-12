import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../config/runtime-settings.js";
import { openSecret, sealSecret } from "./secret-cipher.js";
import {
	testKeyring,
	useVariableKeyring,
} from "./testing/environment-fixture.js";

afterEach(() => configureRuntime(DEFAULT_RUNTIME_SETTINGS));

describe("secret-cipher", () => {
	it("seals and opens a value in its slot, never as plaintext", () => {
		useVariableKeyring(testKeyring());
		const sealed = sealSecret("s3cret-token", "shared:environment:1:v1");
		expect(sealed).not.toContain("s3cret-token");
		expect(sealed.startsWith("v1.k1.")).toBe(true);
		expect(openSecret(sealed, "shared:environment:1:v1")).toBe("s3cret-token");
	});

	it("does not open a value moved to another slot", () => {
		useVariableKeyring(testKeyring());
		const sealed = sealSecret("value", "local:ada:global:1:token");
		expect(openSecret(sealed, "local:eve:global:1:token")).toBeNull();
	});

	it("does not open a value with the wrong key", () => {
		useVariableKeyring(testKeyring());
		const sealed = sealSecret("value", "slot");
		useVariableKeyring(testKeyring());
		expect(openSecret(sealed, "slot")).toBeNull();
	});

	it("still opens values of a rotated key kept for decryption", () => {
		const old = testKeyring("old");
		useVariableKeyring(old);
		const sealed = sealSecret("value", "slot");
		const fresh = testKeyring("new");
		if (!old || !fresh) throw new Error("keyring");
		useVariableKeyring({
			activeKid: "new",
			keys: new Map([...fresh.keys, ...old.keys]),
		});
		expect(openSecret(sealed, "slot")).toBe("value");
		expect(sealSecret("next", "slot").startsWith("v1.new.")).toBe(true);
	});

	it("refuses to seal without a keyring (503) and opens nothing", () => {
		useVariableKeyring(null);
		expect(() => sealSecret("value", "slot")).toThrow(
			expect.objectContaining({
				status: 503,
				code: "SECRET_STORAGE_UNAVAILABLE",
			}),
		);
		expect(openSecret("v1.k1.a.b.c", "slot")).toBeNull();
	});
});
