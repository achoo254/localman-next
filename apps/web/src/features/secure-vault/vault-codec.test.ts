import type { SecretVaultParams } from "@localman/shared/api-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	openLocalValues,
	sealLocalWrites,
	settleLocalValues,
} from "./vault-codec";
import {
	VaultLockedError,
	createNewVault,
	lockVault,
	resetVaultSession,
	setVaultPrompt,
	unlockWith,
} from "./vault-session";

const server = vi.hoisted(() => ({
	params: undefined as SecretVaultParams | null | undefined,
}));

vi.mock("./vault-api", () => ({
	fetchVaultParams: async () => server.params,
	saveVaultParams: async (params: SecretVaultParams) => {
		server.params = params;
		return params;
	},
	resetVaultOnServer: async () => 0,
}));

vi.mock("../auth/use-current-user", () => ({
	peekCurrentUser: () => ({
		status: "authenticated",
		user: { sub: "acc_ada" },
	}),
}));

const SCOPE = "environment:65f0a1b2c3d4e5f60718293a";
const target = {
	path: "/api/v1/environments/x/local-values",
	scope: SCOPE,
	secretKeys: new Set(["token"]),
};
const PASSPHRASE = "correct horse battery";

beforeEach(() => {
	resetVaultSession();
	setVaultPrompt(null);
});
afterEach(async () => {
	await lockVault();
});

describe("local values through the vault", () => {
	it("leaves values alone while the server does not run the vault", async () => {
		server.params = undefined;
		const writes = [{ key: "token", value: "plain" }];
		expect(await sealLocalWrites(target, writes)).toEqual(writes);
	});

	it("asks to create a vault, then seals only the secret's value", async () => {
		server.params = null;
		setVaultPrompt(async (need) => {
			expect(need).toBe("create");
			await createNewVault(PASSPHRASE);
			return true;
		});
		const sealed = await sealLocalWrites(target, [
			{ key: "token", value: "s3cret" },
			{ key: "host", value: "api.test" },
			{ key: "old", value: null },
		]);
		expect(sealed[0]?.value).toMatch(/^lmv1:/);
		expect(sealed.slice(1)).toEqual([
			{ key: "host", value: "api.test" },
			{ key: "old", value: null },
		]);
		const stored = [{ key: "token", value: sealed[0]?.value ?? "" }];
		expect(openLocalValues(SCOPE, stored)).toEqual([
			{ key: "token", value: "s3cret" },
		]);
	});

	it("reads a value as locked until the vault opens", async () => {
		server.params = null;
		setVaultPrompt(async () => {
			await createNewVault(PASSPHRASE);
			return true;
		});
		const [sealed] = await sealLocalWrites(target, [
			{ key: "token", value: "s3cret" },
		]);
		const stored = [{ key: "token", value: sealed?.value ?? "" }];
		await lockVault();
		expect(openLocalValues(SCOPE, stored)).toEqual([
			{ key: "token", value: "", locked: true },
		]);
		await unlockWith(PASSPHRASE);
		await settleLocalValues(SCOPE, stored);
		expect(openLocalValues(SCOPE, stored)).toEqual([
			{ key: "token", value: "s3cret" },
		]);
		// Bound to its name: the same ciphertext on another name never opens.
		const moved = [{ key: "other", value: sealed?.value ?? "" }];
		await settleLocalValues(SCOPE, moved);
		expect(openLocalValues(SCOPE, moved)[0]?.locked).toBe(true);
	});

	it("seals a secret typed to look like a ciphertext", async () => {
		server.params = null;
		setVaultPrompt(async () => {
			await createNewVault(PASSPHRASE);
			return true;
		});
		const lookalike = `lmv1:${"A".repeat(60)}`;
		const [sealed] = await sealLocalWrites(target, [
			{ key: "token", value: lookalike },
		]);
		expect(sealed?.value).toMatch(/^lmv1:/);
		expect(sealed?.value).not.toBe(lookalike);
		const stored = [{ key: "token", value: sealed?.value ?? "" }];
		expect(openLocalValues(SCOPE, stored)[0]?.value).toBe(lookalike);
	});

	it("tells a value sealed by another vault from a locked one", async () => {
		server.params = null;
		setVaultPrompt(async () => {
			await createNewVault(PASSPHRASE);
			return true;
		});
		const [sealed] = await sealLocalWrites(target, [
			{ key: "token", value: "s3cret" },
		]);
		const stored = [{ key: "token", value: sealed?.value ?? "" }];
		// Forgot the passphrase: a new vault cannot open the old value.
		resetVaultSession();
		server.params = null;
		await createNewVault("another long passphrase");
		await settleLocalValues(SCOPE, stored);
		expect(openLocalValues(SCOPE, stored)).toEqual([
			{ key: "token", value: "", locked: true, unreadable: true },
		]);
	});

	it("refuses to save a secret when the user does not unlock", async () => {
		server.params = null;
		setVaultPrompt(async () => false);
		await expect(
			sealLocalWrites(target, [{ key: "token", value: "s3cret" }]),
		).rejects.toBeInstanceOf(VaultLockedError);
	});
});
