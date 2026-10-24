import { describe, expect, it } from "vitest";
import {
	VAULT_PREFIX,
	WrongPassphraseError,
	createVault,
	deriveVaultKey,
	openValue,
	sealValue,
	unlockVault,
	valueAad,
} from "./vault-crypto";

const AAD = valueAad("env:e1", "token");

describe("vault-crypto", () => {
	it("opens what it sealed, with the same passphrase on another device", async () => {
		const { params, key } = await createVault("correct horse");
		const sealed = await sealValue(key, "s3cr3t", AAD);
		expect(sealed.startsWith(VAULT_PREFIX)).toBe(true);
		expect(sealed).not.toContain("s3cr3t");
		// Another device: only the passphrase and what the server stores.
		const again = await unlockVault(params, "correct horse");
		expect(await openValue(again, sealed, AAD)).toBe("s3cr3t");
	});

	it("refuses a wrong passphrase", async () => {
		const { params } = await createVault("correct horse");
		await expect(unlockVault(params, "wrong horse")).rejects.toBeInstanceOf(
			WrongPassphraseError,
		);
	});

	it("gives a different ciphertext for the same value each time", async () => {
		const { key } = await createVault("pass");
		const a = await sealValue(key, "same", AAD);
		const b = await sealValue(key, "same", AAD);
		expect(a).not.toBe(b);
	});

	it("does not open a value moved onto another variable", async () => {
		const { key } = await createVault("pass");
		const sealed = await sealValue(key, "v", AAD);
		await expect(
			openValue(key, sealed, valueAad("env:e1", "other")),
		).rejects.toBeInstanceOf(WrongPassphraseError);
	});

	it("refuses text that is not vault ciphertext", async () => {
		const key = await deriveVaultKey("pass", "c2FsdHNhbHRzYWx0c2FsdA", 1000);
		await expect(openValue(key, "plain", AAD)).rejects.toBeInstanceOf(
			WrongPassphraseError,
		);
	});
});
