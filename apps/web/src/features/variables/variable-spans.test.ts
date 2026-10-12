import { describe, expect, it } from "vitest";
import {
	applyEdit,
	findVariableSpans,
	spanAt,
	suggestionAt,
	suggestionEdit,
} from "./variable-spans";

describe("findVariableSpans", () => {
	it("finds every reference with its offsets and trimmed name", () => {
		expect(findVariableSpans("{{baseUrl}}/users/{{ id }}?t={{$guid}}")).toEqual(
			[
				{ from: 0, to: 11, name: "baseUrl" },
				{ from: 18, to: 26, name: "id" },
				{ from: 29, to: 38, name: "$guid" },
			],
		);
	});

	it("skips blank and unclosed references", () => {
		expect(findVariableSpans("{{ }} and {{open")).toEqual([]);
	});
});

describe("spanAt", () => {
	const spans = findVariableSpans("a {{name}} b");
	it("finds the span the caret is strictly inside", () => {
		expect(spanAt(spans, 5)?.name).toBe("name");
	});
	it("ignores a caret on the span's edges", () => {
		expect(spanAt(spans, 2)).toBeNull();
		expect(spanAt(spans, 10)).toBeNull();
	});
});

describe("suggestionAt", () => {
	it("reads the name typed after an unclosed {{", () => {
		expect(suggestionAt("{{baseUrl}}/{{us", 16)).toEqual({
			from: 14,
			query: "us",
		});
		expect(suggestionAt("x {{", 4)).toEqual({ from: 4, query: "" });
	});

	it("offers nothing after a closed reference or a space", () => {
		expect(suggestionAt("{{name}}", 8)).toBeNull();
		expect(suggestionAt("{{na me", 7)).toBeNull();
		expect(suggestionAt("plain", 5)).toBeNull();
	});
});

describe("suggestionEdit", () => {
	it("closes a reference typed at the end", () => {
		const text = "{{ba";
		const target = suggestionAt(text, 4);
		if (!target) throw new Error("no target");
		const edit = suggestionEdit(text, target, 4, "baseUrl");
		expect(applyEdit(text, edit)).toBe("{{baseUrl}}");
		expect(edit.caret).toBe(11);
	});

	it("replaces the rest of a reference already closed after the caret", () => {
		const text = "{{bxUrl}}/users";
		const target = suggestionAt(text, 3);
		if (!target) throw new Error("no target");
		const edit = suggestionEdit(text, target, 3, "baseUrl");
		expect(applyEdit(text, edit)).toBe("{{baseUrl}}/users");
		expect(edit.caret).toBe(11);
	});
});
