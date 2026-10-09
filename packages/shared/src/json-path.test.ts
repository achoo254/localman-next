import { describe, expect, it } from "vitest";
import { parseJsonPath, readJsonPath } from "./json-path.js";

describe("JSONPath subset", () => {
	const body = {
		user: { role: "admin", tags: ["a", "b"] },
		"a.b": { c: 1 },
		items: [{ id: 7 }],
	};

	it.each([
		["$", body],
		["$.user.role", "admin"],
		["$.user.tags[1]", "b"],
		["$.items[0].id", 7],
		["$['a.b'].c", 1],
		['$["a.b"]["c"]', 1],
		["$.missing.x", undefined],
		["$.user.tags[5]", undefined],
		["$.user[0]", undefined],
		["$.items.id", undefined],
	])("%s", (path, expected) => {
		const steps = parseJsonPath(path);
		expect(steps).not.toBeNull();
		expect(readJsonPath(body, steps ?? [])).toEqual(expected);
	});

	it.each([
		"",
		"user.role",
		"$.",
		"$..role",
		"$.*",
		"$[*]",
		"$.a[?(@.b)]",
		"$.a[-1]",
		"$.__proto__",
		"$['constructor']",
		"$.a b",
		`$${".a".repeat(21)}`,
		`$.${"a".repeat(200)}`,
	])("refuses %s", (path) => {
		expect(parseJsonPath(path)).toBeNull();
	});

	it("never reads inherited properties", () => {
		const steps = parseJsonPath("$.toString");
		expect(readJsonPath({}, steps ?? [])).toBeUndefined();
		expect(readJsonPath("text", parseJsonPath("$.length") ?? [])).toBe(
			undefined,
		);
	});
});
