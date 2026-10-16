import { describe, expect, it } from "vitest";
import { mergeEntities } from "./three-way-merge.js";

type Node = Record<string, unknown>;
const req = (name: string, draft: Node = {}, order = "a0"): Node => ({
	kind: "request",
	name,
	order,
	draft: { url: "https://x", method: "GET", ...draft },
});
const NESTED = { nested: new Set(["draft"]), sourceWins: new Set(["order"]) };

describe("three-way merge", () => {
	it("takes each side's change to different fields, without conflict", () => {
		const base = { r1: req("List") };
		const source = { r1: req("List users") };
		const destination = { r1: req("List", { method: "POST" }) };
		const out = mergeEntities(base, source, destination, NESTED);
		expect(out.conflicts).toEqual([]);
		expect(out.result.r1).toEqual(req("List users", { method: "POST" }));
	});

	it("merges inside a nested object field by field", () => {
		const base = { r1: req("A") };
		const source = { r1: req("A", { url: "https://y" }) };
		const destination = { r1: req("A", { method: "PUT" }) };
		const out = mergeEntities(base, source, destination, NESTED);
		expect(out.conflicts).toEqual([]);
		expect(out.result.r1?.draft).toEqual({ url: "https://y", method: "PUT" });
	});

	it("reports the same field changed both ways, and applies a choice", () => {
		const base = { r1: req("A") };
		const source = { r1: req("A", { url: "https://s" }) };
		const destination = { r1: req("A", { url: "https://d" }) };
		const open = mergeEntities(base, source, destination, NESTED);
		expect(open.conflicts.map((c) => c.id)).toEqual(["r1:draft.url"]);
		expect(open.unresolved).toEqual(["r1:draft.url"]);
		expect(open.result.r1?.draft).toMatchObject({ url: "https://d" });
		const chosen = mergeEntities(base, source, destination, {
			...NESTED,
			resolutions: { "r1:draft.url": "source" },
		});
		expect(chosen.unresolved).toEqual([]);
		expect(chosen.result.r1?.draft).toMatchObject({ url: "https://s" });
	});

	it("reports a delete against a change, either way round", () => {
		const base = { r1: req("A"), r2: req("B") };
		const source = { r1: req("A2") };
		const destination = { r2: req("B2") };
		const out = mergeEntities(base, source, destination, NESTED);
		expect(out.conflicts.map((c) => [c.id, c.path])).toEqual([
			["r1", ""],
			["r2", ""],
		]);
		const kept = mergeEntities(base, source, destination, {
			...NESTED,
			resolutions: { r1: "source", r2: "source" },
		});
		expect(Object.keys(kept.result)).toEqual(["r1"]);
	});

	it("deletes what one side deleted and the other left alone", () => {
		const base = { r1: req("A"), r2: req("B") };
		const out = mergeEntities(base, { r2: req("B") }, { r1: req("A") }, NESTED);
		expect(out.conflicts).toEqual([]);
		expect(out.result).toEqual({});
	});

	it("keeps what both sides added", () => {
		const out = mergeEntities(
			{},
			{ s1: req("From source") },
			{ d1: req("From destination") },
			NESTED,
		);
		expect(Object.keys(out.result).sort()).toEqual(["d1", "s1"]);
	});

	it("takes the source order when both reordered, without conflict", () => {
		const base = { r1: req("A", {}, "a0") };
		const out = mergeEntities(
			base,
			{ r1: req("A", {}, "a5") },
			{ r1: req("A", {}, "a2") },
			NESTED,
		);
		expect(out.conflicts).toEqual([]);
		expect(out.result.r1?.order).toBe("a5");
	});

	it("ignores key order when comparing content", () => {
		const base = { r1: { a: 1, b: { c: 2, d: 3 } } };
		const source = { r1: { b: { d: 3, c: 2 }, a: 1 } };
		const out = mergeEntities(base, source, {
			r1: { a: 9, b: { c: 2, d: 3 } },
		});
		expect(out.conflicts).toEqual([]);
		expect(out.result.r1).toEqual({ a: 9, b: { c: 2, d: 3 } });
	});
});
