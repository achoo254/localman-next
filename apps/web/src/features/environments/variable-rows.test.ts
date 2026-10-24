import type { VariableView } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { mergedLocal } from "./local-value-map";
import {
	blankDraft,
	draftsOf,
	duplicateNames,
	rowsOf,
	toWrites,
} from "./variable-rows";

const variable = (
	key: string,
	sharedValue: string | null,
	extra: Partial<VariableView> = {},
): VariableView => ({
	id: `id-${key}`,
	key,
	type: "default",
	enabled: true,
	description: "",
	sharedValue,
	sharedHidden: false,
	...extra,
});

describe("variable rows", () => {
	it("marks a local value that differs from the shared one as edited", () => {
		const rows = rowsOf(
			draftsOf([variable("a", "1"), variable("b", "2"), variable("c", null)]),
			new Map([
				["a", "1"],
				["b", "local"],
				["c", "mine"],
			]),
		);
		expect(rows.map((row) => [row.variable.key, row.sync])).toEqual([
			["a", "synced"],
			["b", "edited"],
			["c", "edited"],
		]);
	});

	it("counts any local value of a withheld secret as edited", () => {
		const [row] = rowsOf(
			draftsOf([
				variable("token", null, { type: "secret", sharedHidden: true }),
			]),
			new Map([["token", "x"]]),
		);
		expect(row?.sync).toBe("edited");
	});

	it("lists local values without a definition after the variables", () => {
		const rows = rowsOf(
			draftsOf([variable("a", "1")]),
			new Map([["script", "s"]]),
		);
		expect(rows[1]).toMatchObject({ localOnly: true, local: "s" });
		expect(rows[1]?.variable.key).toBe("script");
	});

	it("applies unsaved local edits: a value sets, null resets", () => {
		const map = mergedLocal(
			[
				{ key: "a", value: "1" },
				{ key: "b", value: "2" },
			],
			{ a: "changed", b: null, c: undefined },
		);
		expect([...map]).toEqual([["a", "changed"]]);
	});

	it("sends named rows only, keeping ids of saved variables", () => {
		const drafts = [
			...draftsOf([variable("a", "1")]),
			{ ...blankDraft("new-1"), key: " b ", sharedValue: "2" },
			blankDraft("new-2"),
		];
		expect(toWrites(drafts)).toEqual([
			{
				id: "id-a",
				key: "a",
				type: "default",
				enabled: true,
				description: "",
				sharedValue: "1",
			},
			{
				key: "b",
				type: "default",
				enabled: true,
				description: "",
				sharedValue: "2",
			},
		]);
	});

	it("finds names used twice", () => {
		const drafts = draftsOf([
			variable("a", "1"),
			variable("a", "2"),
			variable("b", "3"),
		]);
		expect([...duplicateNames(drafts)]).toEqual(["a"]);
	});
});
