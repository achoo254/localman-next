import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en/dictionary";
import { createTranslator } from "../../i18n/translate";
import { describeChange } from "./describe-change";
import { diffLines, jsonLines } from "./line-diff";

describe("diffLines", () => {
	it("keeps common lines and marks removed before added", () => {
		const lines = diffLines(["a", "b", "c"], ["a", "x", "c", "d"]);
		expect(lines).toEqual([
			{ kind: "same", text: "a" },
			{ kind: "removed", text: "b" },
			{ kind: "added", text: "x" },
			{ kind: "same", text: "c" },
			{ kind: "added", text: "d" },
		]);
	});

	it("diffs formatted JSON, and treats a missing side as no lines", () => {
		const before = jsonLines({ name: "Users", auth: { type: "none" } });
		const after = jsonLines({ name: "Team", auth: { type: "none" } });
		const changed = diffLines(before, after).filter((l) => l.kind !== "same");
		expect(changed).toEqual([
			{ kind: "removed", text: '  "name": "Users",' },
			{ kind: "added", text: '  "name": "Team",' },
		]);
		expect(jsonLines(null)).toEqual([]);
		expect(
			diffLines([], jsonLines({ a: 1 })).every((l) => l.kind === "added"),
		).toBe(true);
	});
});

describe("describeChange", () => {
	const t = createTranslator("en", en).t;
	const base = {
		entityKind: "folder" as const,
		entityName: "Users",
		fields: [],
	};

	it("words each action", () => {
		expect(describeChange({ ...base, action: "create" }, t)).toBe(
			"Created folder Users",
		);
		expect(
			describeChange({ ...base, action: "update", fields: ["name"] }, t),
		).toBe("Renamed folder Users");
		expect(
			describeChange(
				{ ...base, action: "update", fields: ["scripts", "auth", "custom"] },
				t,
			),
		).toBe("Edited scripts, auth, custom of folder Users");
		expect(describeChange({ ...base, action: "restore" }, t)).toBe(
			"Restored the collection to an earlier change",
		);
	});
});
