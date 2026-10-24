import type { LocalValue, LocalValueWrite } from "@localman/shared/api-client";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resealWrites, useResealLegacy } from "./use-reseal-legacy";
import type { VaultStatus } from "./vault-session";

const vault = vi.hoisted(() => ({ status: "locked" as VaultStatus }));
const server = vi.hoisted(() => ({
	/** The scope's values when the write's turn comes. */
	now: [] as LocalValue[],
	sent: [] as LocalValueWrite[][],
	fail: false,
}));

vi.mock("./use-vault-state", () => ({
	useKnownVaultState: () => ({ status: vault.status, params: null }),
}));
vi.mock("../environments/local-values-api", () => ({
	patchLocalWhenDue: async (
		_target: unknown,
		build: (latest: LocalValue[] | undefined) => LocalValueWrite[],
	) => {
		if (server.fail) throw new Error("offline");
		const writes = build(undefined);
		if (writes.length === 0) return null;
		server.sent.push(writes);
		return [];
	},
}));

const CIPHER = `lmv1:${"A".repeat(60)}`;
const values: LocalValue[] = [
	{ key: "token", value: "plain-before-vault" },
	{ key: "sealed", value: CIPHER },
	{ key: "host", value: "api.test" },
];
const target = (path: string) => ({
	path,
	scope: "environment:e1",
	secretKeys: new Set(["token", "sealed"]),
});

function render(path: string) {
	const store = vi.fn();
	const view = renderHook(() =>
		useResealLegacy(target(path), values, () => server.now, store),
	);
	return { ...view, store };
}

beforeEach(() => {
	server.now = values;
	server.sent = [];
	server.fail = false;
});

describe("moving secrets saved before the vault into it", () => {
	it("saves a secret's plain value again once the vault is open, once", async () => {
		vault.status = "locked";
		const { rerender, store } = render("/e1");
		expect(server.sent).toEqual([]);
		vault.status = "unlocked";
		rerender();
		await waitFor(() =>
			expect(server.sent).toEqual([
				[{ key: "token", value: "plain-before-vault" }],
			]),
		);
		expect(store).toHaveBeenCalledWith([]);
		rerender();
		expect(server.sent).toHaveLength(1);
	});

	it("leaves a value the person changed meanwhile alone", async () => {
		// By its turn, the table's autosave already saved a new value.
		server.now = [{ key: "token", value: CIPHER }];
		vault.status = "unlocked";
		const { store } = render("/e2");
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(server.sent).toEqual([]);
		expect(store).not.toHaveBeenCalled();
	});

	it("tries again after a failure, the next time the vault opens", async () => {
		server.fail = true;
		vault.status = "unlocked";
		const { rerender } = render("/e3");
		await new Promise((resolve) => setTimeout(resolve, 0));
		server.fail = false;
		vault.status = "locked";
		rerender();
		vault.status = "unlocked";
		rerender();
		await waitFor(() => expect(server.sent).toHaveLength(1));
	});
});

describe("resealWrites", () => {
	it("keeps the agents' copy of a value the server keeps one of", () => {
		const plain = new Map([
			["token", "abc"],
			["gone", "x"],
			["changed", "old"],
		]);
		expect(
			resealWrites(plain, [
				{ key: "token", value: "abc", agentUse: true },
				{ key: "changed", value: "new" },
			]),
		).toEqual([{ key: "token", value: "abc", agentValue: "abc" }]);
	});
});
