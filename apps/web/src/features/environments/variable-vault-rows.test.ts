import type { VariableView } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { lockedKeysOf, mergedLocal } from "./local-value-map";
import { batchTargets, localWritesAfterSave } from "./variable-batch";
import { draftsOf, rowsOf } from "./variable-rows";

const secret = (key: string): VariableView => ({
	id: `v-${key}`,
	key,
	type: "secret",
	enabled: true,
	description: "",
	sharedValue: "shared",
	sharedHidden: false,
});

// token: locked in the vault · other: sealed by another vault · plain: readable
const saved = [
	{ key: "token", value: "", locked: true },
	{ key: "other", value: "", locked: true, unreadable: true },
	{ key: "plain", value: "mine" },
];

describe("local values locked in the vault", () => {
	it("are never part of the values that can be written", () => {
		expect([...mergedLocal(saved, {})]).toEqual([["plain", "mine"]]);
		expect(lockedKeysOf(saved)).toEqual(
			new Map([
				["token", false],
				["other", true],
			]),
		);
		// A new value typed over one replaces it.
		expect(lockedKeysOf(saved, { other: "new" })).toEqual(
			new Map([["token", false]]),
		);
	});

	it("never move to a new name nor get overwritten by one", () => {
		const drafts = draftsOf([secret("token"), secret("plain")]).map((v) =>
			v.key === "token" ? { ...v, key: "renamed" } : v,
		);
		const local = mergedLocal(saved, {});
		const locked = lockedKeysOf(saved);
		// The locked value stays under its name (it cannot be read to move).
		expect(localWritesAfterSave(drafts, local, [], locked)).toEqual([]);
		// Nor does a readable value move onto a name holding a locked one.
		const ontoLocked = draftsOf([secret("plain")]).map((v) => ({
			...v,
			key: "token",
		}));
		expect(localWritesAfterSave(ontoLocked, local, [], locked)).toEqual([]);
	});

	it("are left out of Reset all, and flagged on their rows", () => {
		const drafts = draftsOf([
			secret("token"),
			secret("other"),
			secret("plain"),
		]);
		const rows = rowsOf(drafts, mergedLocal(saved, {}), lockedKeysOf(saved));
		expect(
			rows.map((row) => [row.localKey, row.locked, row.unreadable]),
		).toEqual([
			["token", true, undefined],
			["other", true, true],
			["plain", undefined, undefined],
		]);
		expect(batchTargets(rows, true).reset.map((row) => row.localKey)).toEqual([
			"plain",
		]);
	});
});
