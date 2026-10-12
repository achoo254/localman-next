import { describe, expect, it } from "vitest";
import {
	ENVIRONMENT_VARIABLES_MAX,
	VARIABLE_VALUE_MAX,
} from "./environment-model.js";
import { parsePostmanEnvironment } from "./postman-environment.js";

describe("parsePostmanEnvironment rejects", () => {
	const long = (n: number) => "x".repeat(n);
	it.each([
		["a non-object", "nope", "not_an_environment", undefined],
		["a missing values array", { name: "x" }, "not_an_environment", undefined],
		["a nameless value", { values: [{ value: "1" }] }, "invalid_variable", 0],
		[
			"an object value",
			{ values: [{ key: "a", value: {} }] },
			"invalid_variable",
			0,
		],
		["an empty key", { values: [{ key: "a" }, { key: "  " }] }, "empty_key", 1],
		["a long key", { values: [{ key: long(201) }] }, "key_too_long", 0],
		[
			"a duplicate key",
			{ values: [{ key: "a" }, { key: "b" }, { key: "a " }] },
			"duplicate_key",
			2,
		],
		[
			"a long value",
			{ values: [{ key: "a", value: long(VARIABLE_VALUE_MAX + 1) }] },
			"value_too_long",
			0,
		],
		[
			"a long name",
			{ name: long(201), values: [] },
			"name_too_long",
			undefined,
		],
		[
			"too many variables",
			{
				values: Array.from(
					{ length: ENVIRONMENT_VARIABLES_MAX + 1 },
					(_, i) => ({
						key: `k${i}`,
					}),
				),
			},
			"too_many_variables",
			undefined,
		],
	])("%s", (_label, raw, issue, index) => {
		const parsed = parsePostmanEnvironment(raw);
		expect(parsed).toEqual(
			index === undefined ? { ok: false, issue } : { ok: false, issue, index },
		);
	});
});
