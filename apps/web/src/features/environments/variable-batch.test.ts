import type { VariableView } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import {
	batchTargets,
	localWritesAfterSave,
	resetPatch,
	secretsLeaving,
	shareActionOf,
	sharedDrafts,
	unsharedDrafts,
} from "./variable-batch";
import { draftsOf, rowsOf } from "./variable-rows";

const variable = (
	key: string,
	sharedValue: string | null,
	extra: Partial<VariableView> = {},
): VariableView => ({
	id: `v-${key}`,
	key,
	type: "default",
	enabled: true,
	description: "",
	sharedValue,
	sharedHidden: false,
	...extra,
});

// a: shared, local differs (update) · b: not shared, local (share)
// c: shared, no local · d: shared, local equal (synced, reset only)
// s: withheld secret with a local value · x: local value without definition
const drafts = draftsOf([
	variable("a", "1"),
	variable("b", null),
	variable("c", "3"),
	variable("d", "4"),
	variable("s", null, { type: "secret", sharedHidden: true }),
]);
const local = new Map([
	["a", "10"],
	["b", "20"],
	["d", "4"],
	["s", "mine"],
	["x", "script"],
]);
const rows = rowsOf(drafts, local);
const keys = (list: { variable: { key: string } }[]) =>
	list.map((row) => row.variable.key);

describe("shareActionOf", () => {
	it("offers update for a shared value and share otherwise, to Editors only", () => {
		expect(rows.map((row) => shareActionOf(row, true))).toEqual([
			"update",
			"share",
			null,
			null,
			"update",
			"share",
		]);
		expect(rows.every((row) => shareActionOf(row, false) === null)).toBe(true);
	});
});

describe("batchTargets", () => {
	it("applies each row action to every row that offers it", () => {
		const targets = batchTargets(rows, true);
		expect(keys(targets.share)).toEqual(["b", "x"]);
		expect(keys(targets.update)).toEqual(["a"]);
		expect(keys(targets.reset)).toEqual(["a", "b", "d", "s", "x"]);
		expect(keys(targets.unshare)).toEqual(["a", "c", "d"]);
	});

	it("leaves a withheld secret out of shared writes but resets its local value", () => {
		const targets = batchTargets(rows, true);
		for (const list of [targets.share, targets.update, targets.unshare]) {
			expect(keys(list)).not.toContain("s");
		}
		expect(keys(targets.reset)).toContain("s");
	});

	it("gives a Viewer only Reset all", () => {
		const targets = batchTargets(rows, false);
		expect(targets.share).toEqual([]);
		expect(targets.update).toEqual([]);
		expect(targets.unshare).toEqual([]);
		expect(keys(targets.reset)).toEqual(["a", "b", "d", "s", "x"]);
	});
});

describe("batch drafts", () => {
	it("shares local values, adding a variable for one without a definition", () => {
		const targets = batchTargets(rows, true);
		let n = 0;
		const next = sharedDrafts(
			drafts,
			[...targets.share, ...targets.update],
			() => {
				n += 1;
				return `new-${n}`;
			},
		);
		expect(next.map((v) => [v.key, v.sharedValue])).toEqual([
			["a", "10"],
			["b", "20"],
			["c", "3"],
			["d", "4"],
			["s", null],
			["x", "script"],
		]);
		expect(next.at(-1)).toMatchObject({ rowId: "new-1", isNew: true });
	});

	it("unshares only the given rows", () => {
		const next = unsharedDrafts(drafts, batchTargets(rows, true).unshare);
		expect(next.map((v) => v.sharedValue)).toEqual([
			null,
			null,
			null,
			null,
			null,
		]);
		expect(next[4]?.sharedHidden).toBe(true);
	});

	it("resets local values by their saved name", () => {
		expect(resetPatch(rows)).toEqual({
			a: null,
			b: null,
			d: null,
			s: null,
			x: null,
		});
		expect(resetPatch([])).toEqual({});
	});

	it("moves renamed local values and resets shared ones after a save", () => {
		const renamed = draftsOf([variable("a", "1"), variable("b", "2")]).map(
			(v) => (v.key === "a" ? { ...v, key: "a2" } : v),
		);
		const values = new Map([
			["a", "10"],
			["b", "20"],
		]);
		expect(localWritesAfterSave(renamed, values, ["a", "b", "gone"])).toEqual([
			{ key: "a", value: null },
			{ key: "a2", value: "10" },
			{ key: "b", value: null },
		]);
		expect(localWritesAfterSave(renamed, values, [])).toHaveLength(2);
	});
});

describe("sharing secrets out of the vault", () => {
	const fromVault = (value: string) => value === "script";

	it("lists the secrets and the vault values a share would take out", () => {
		expect(keys(secretsLeaving(rows, fromVault))).toEqual(["s", "x"]);
		expect(keys(secretsLeaving(rows, () => false))).toEqual(["s"]);
	});

	it("keeps a vault value without a definition a secret once shared", () => {
		const loose = rows.filter((row) => row.localOnly);
		let id = 0;
		const next = sharedDrafts(drafts, loose, () => `n${++id}`, fromVault);
		expect(next.at(-1)).toMatchObject({
			key: "x",
			sharedValue: "script",
			type: "secret",
		});
		const plainShare = sharedDrafts(drafts, loose, () => "n9");
		expect(plainShare.at(-1)?.type).toBe("default");
	});
});
