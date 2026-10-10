import { describe, expect, it } from "vitest";
import { arrayElementOffset, recordIndexById } from "./record-position";

describe("recordIndexById", () => {
	it("matches string and number ids by their text", () => {
		const records = [{ id: "a1" }, { id: 7 }, { name: "no id" }, { id: true }];
		expect(recordIndexById(records, "a1")).toBe(0);
		expect(recordIndexById(records, "7")).toBe(1);
		expect(recordIndexById(records, "true")).toBe(-1);
		expect(recordIndexById(records, "missing")).toBe(-1);
	});
});

describe("arrayElementOffset", () => {
	it("finds each element of pretty-printed records", () => {
		const text = JSON.stringify(
			[{ id: "1" }, { id: "2" }, { id: "3" }],
			null,
			2,
		);
		const third = arrayElementOffset(text, 2);
		expect(third).not.toBeNull();
		expect(text.slice(third ?? 0)).toMatch(/^\{\s+"id": "3"/);
		expect(arrayElementOffset(text, 3)).toBeNull();
	});

	it("is not fooled by brackets, commas and escaped quotes inside strings", () => {
		const text =
			'[{"id":"1","note":"a, [b] {c} \\"d\\""},{"id":"2","tags":[1,2,{"x":"]"}]},{"id":"3"}]';
		expect(text.slice(arrayElementOffset(text, 1) ?? 0)).toMatch(/^\{"id":"2"/);
		expect(text.slice(arrayElementOffset(text, 2) ?? 0)).toBe('{"id":"3"}]');
	});

	it("has nothing to find in an empty array or a non-array", () => {
		expect(arrayElementOffset("[ ]", 0)).toBeNull();
		expect(arrayElementOffset('{"id":"1"}', 0)).toBeNull();
	});
});
