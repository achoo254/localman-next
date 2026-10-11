import { describe, expect, it } from "vitest";
import { type DiffLine, collapseDiff, diffLines } from "./line-diff";

const lines = (prefix: string, n: number) =>
	Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const kinds = (diff: readonly DiffLine[]) => diff.map((line) => line.kind);

describe("diffLines on large texts", () => {
	it("keeps the shared start and end aside, so a small edit stays precise", () => {
		const head = lines("head", 3000);
		const tail = lines("tail", 3000);
		const diff = diffLines(
			[...head, "old", ...tail],
			[...head, "new", ...tail],
		);
		expect(diff.filter((line) => line.kind !== "same")).toEqual([
			{ kind: "removed", text: "old" },
			{ kind: "added", text: "new" },
		]);
		expect(diff).toHaveLength(6002);
	});

	it("falls back to all removed, then all added, past the comparison limit", () => {
		const before = ["same", ...lines("a", 2100), "end"];
		const after = ["same", ...lines("b", 2100), "end"];
		const diff = diffLines(before, after);
		expect(kinds(diff)).toEqual([
			"same",
			...Array<string>(2100).fill("removed"),
			...Array<string>(2100).fill("added"),
			"same",
		]);
		expect(diff[1]).toEqual({ kind: "removed", text: "a0" });
		expect(diff[2101]).toEqual({ kind: "added", text: "b0" });
	});
});

describe("collapseDiff", () => {
	const same = (text: string): DiffLine => ({ kind: "same", text });

	it("keeps three lines around each change and folds the rest", () => {
		const diff: DiffLine[] = [
			...lines("x", 5).map(same),
			{ kind: "added", text: "+" },
			...lines("y", 10).map(same),
			{ kind: "removed", text: "-" },
		];
		const chunks = collapseDiff(diff);
		expect(chunks.map((c) => [c.kind, c.lines.length])).toEqual([
			["folded", 2],
			["lines", 7],
			["folded", 4],
			["lines", 4],
		]);
	});

	it("leaves a diff without changes, or with short runs, whole", () => {
		const flat = lines("z", 4).map(same);
		expect(collapseDiff(flat)).toEqual([{ kind: "lines", lines: flat }]);
		const close: DiffLine[] = [
			{ kind: "added", text: "+" },
			...flat,
			{ kind: "added", text: "+" },
		];
		expect(collapseDiff(close, 2)).toEqual([{ kind: "lines", lines: close }]);
	});
});
