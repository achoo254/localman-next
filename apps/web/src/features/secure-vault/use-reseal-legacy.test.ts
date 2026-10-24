import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useResealLegacy } from "./use-reseal-legacy";
import type { VaultStatus } from "./vault-session";

const vault = vi.hoisted(() => ({ status: "locked" as VaultStatus }));

vi.mock("./vault-session", () => ({
	useKnownVaultState: () => ({ status: vault.status, params: null }),
}));

const CIPHER = `lmv1:${"A".repeat(60)}`;
const values = [
	{ key: "token", value: "plain-before-vault" },
	{ key: "sealed", value: CIPHER },
	{ key: "host", value: "api.test" },
];
const secrets = new Set(["token", "sealed"]);

describe("moving secrets saved before the vault into it", () => {
	it("saves a secret's plain value again once the vault is open, once", async () => {
		const save = vi.fn(async () => undefined);
		vault.status = "locked";
		const { rerender } = renderHook(() =>
			useResealLegacy("environment:e1", values, secrets, save),
		);
		expect(save).not.toHaveBeenCalled();
		vault.status = "unlocked";
		rerender();
		await waitFor(() =>
			expect(save).toHaveBeenCalledWith([
				{ key: "token", value: "plain-before-vault" },
			]),
		);
		rerender();
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("tries again after a failure", async () => {
		const save = vi
			.fn<() => Promise<undefined>>()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue(undefined);
		vault.status = "unlocked";
		const { rerender } = renderHook(() =>
			useResealLegacy("environment:e2", values, secrets, save),
		);
		await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
		// The failure frees the names; the next change of status retries.
		vault.status = "locked";
		rerender();
		vault.status = "unlocked";
		rerender();
		await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
	});
});
