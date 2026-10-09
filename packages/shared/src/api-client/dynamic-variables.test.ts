import { describe, expect, it } from "vitest";
import {
	DYNAMIC_VARIABLE_NAMES,
	isDynamicVariable,
	listDynamicVariables,
	resolveDynamicVariable,
	uuidV4,
} from "./dynamic-variables.js";

describe("dynamic variables", () => {
	it("every listed variable resolves to a non-empty string", () => {
		for (const name of DYNAMIC_VARIABLE_NAMES) {
			expect(resolveDynamicVariable(name)).toMatch(/\S/);
		}
		expect(listDynamicVariables().map((v) => v.name)).toEqual([
			...DYNAMIC_VARIABLE_NAMES,
		]);
	});

	it("produces fresh values in the expected shapes", () => {
		expect(uuidV4()).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(uuidV4()).not.toBe(uuidV4());
		expect(resolveDynamicVariable("$randomColor")).toMatch(/^#[0-9a-f]{6}$/);
		expect(resolveDynamicVariable(" $isoTimestamp ")).toMatch(
			/^\d{4}-\d{2}-\d{2}T/,
		);
		const n = Number(resolveDynamicVariable("$randomInt"));
		expect(n >= 0 && n <= 1000).toBe(true);
	});

	it("does not resolve unknown or inherited names", () => {
		expect(resolveDynamicVariable("$nope")).toBeNull();
		expect(resolveDynamicVariable("toString")).toBeNull();
		expect(isDynamicVariable("$guid")).toBe(true);
		expect(isDynamicVariable("constructor")).toBe(false);
	});
});
