import { describe, expect, it } from "vitest";
import {
	forgetVaultKeys,
	recallVaultKey,
	rememberVaultKey,
} from "./vault-key-store";

const aesKey = (): Promise<CryptoKey> =>
	crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
		"encrypt",
		"decrypt",
	]);

describe("vault keys on this device", () => {
	it("forgets one account's keys only", async () => {
		const ada = await aesKey();
		const bob = await aesKey();
		await rememberVaultKey("acc_ada", "salt-1", ada);
		await rememberVaultKey("acc_bob", "salt-1", bob);
		await forgetVaultKeys("acc_ada");
		expect(await recallVaultKey("acc_ada", "salt-1")).toBeNull();
		expect(await recallVaultKey("acc_bob", "salt-1")).toBe(bob);
		await forgetVaultKeys("acc_bob");
	});
});
