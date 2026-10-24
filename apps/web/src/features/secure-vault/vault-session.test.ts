import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createNewVault,
	lockVault,
	onVaultReset,
	resetVaultSession,
	vaultKey,
	vaultState,
} from "./vault-session";
import { resetVaultServer, vaultServer } from "./vault-test-support";

vi.mock(
	"./vault-api",
	async () => (await import("./vault-test-support")).vaultApiDouble,
);
vi.mock("../auth/use-current-user", () => ({
	peekCurrentUser: () => ({
		status: "authenticated",
		user: { sub: "acc_ada" },
	}),
}));
const store = vi.hoisted(() => ({ fail: false }));
vi.mock("./vault-key-store", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./vault-key-store")>();
	return {
		...actual,
		forgetVaultKeys: async (sub: string) => {
			if (store.fail) throw new Error("storage unavailable");
			return actual.forgetVaultKeys(sub);
		},
	};
});

const PASSPHRASE = "correct horse battery";

beforeEach(async () => {
	store.fail = false;
	resetVaultSession();
	resetVaultServer(null);
	await createNewVault(PASSPHRASE);
});
afterEach(async () => {
	store.fail = false;
	await lockVault();
});

describe("vault session", () => {
	it("locks in memory first, even when the device store fails", async () => {
		expect(vaultKey()).not.toBeNull();
		store.fail = true;
		await expect(lockVault()).rejects.toThrow("storage unavailable");
		expect(vaultKey()).toBeNull();
		expect(vaultState().status).toBe("locked");
	});

	it.runIf(typeof BroadcastChannel !== "undefined")(
		"follows a lock and a reset made in another tab",
		async () => {
			const otherTab = new BroadcastChannel("localman-vault");
			const reset = vi.fn();
			const stop = onVaultReset(reset);
			try {
				otherTab.postMessage("lock");
				await waitFor(() => expect(vaultState().status).toBe("locked"));
				expect(vaultKey()).toBeNull();

				vaultServer.params = null;
				otherTab.postMessage("reset");
				await waitFor(() => expect(vaultState().status).toBe("none"));
				expect(reset).toHaveBeenCalledTimes(1);
			} finally {
				stop();
				otherTab.close();
			}
		},
	);
});
