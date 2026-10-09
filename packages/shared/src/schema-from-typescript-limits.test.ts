import { describe, expect, it } from "vitest";
import { MAX_SCHEMA_FIELDS } from "./resource-constants.js";
import { resourceFieldsSchema } from "./resource-schema.js";
import {
	MAX_TYPESCRIPT_SCHEMA_BYTES,
	schemaFromTypeScript,
} from "./schema-from-typescript.js";
import type { SchemaImportResult } from "./schema-import-fields.js";

function fieldsOf(result: SchemaImportResult) {
	if (!result.ok)
		throw new Error(`${result.error.code}: ${result.error.message}`);
	expect(resourceFieldsSchema.safeParse(result.fields).success).toBe(true);
	return result.fields;
}

function errorOf(result: SchemaImportResult): string {
	return result.ok ? "ok" : result.error.code;
}

describe("schemaFromTypeScript on unsafe input", () => {
	it("renames or drops unsafe field names and skips methods", () => {
		const result = schemaFromTypeScript(`interface X {
			__proto__: string; constructor: string; prototype: string; id: number;
			"first name": string; "a/b": number; "☃": string; dup: string; dup: number;
			save(): void; onClick: () => void; [key: string]: unknown;
			ref: Unknown; nothing: null;
		}`);
		expect(fieldsOf(result).map((f) => f.name)).toEqual([
			"first_name",
			"a_b",
			"dup",
			"ref",
			"nothing",
		]);
		expect(
			result.ok && result.warnings.map((w) => w.message),
		).toMatchSnapshot();
	});

	it("keeps at most MAX_SCHEMA_FIELDS fields", () => {
		const members = Array.from({ length: 80 }, (_, i) => `f${i}: string;`);
		const result = schemaFromTypeScript(`interface X { ${members.join(" ")} }`);
		expect(fieldsOf(result)).toHaveLength(MAX_SCHEMA_FIELDS);
		expect(result.ok && result.warnings.at(-1)?.message).toMatch(/first 50/);
	});

	it("rejects code, oversized and deeply nested input safely", () => {
		const cases: [unknown, string][] = [
			[
				'const fs = require("fs"); fs.rmSync("/", { recursive: true })',
				"INVALID_INPUT",
			],
			["interface A { a: string }\nprocess.exit(1)", "INVALID_INPUT"],
			["interface A { a: string } eval('1')", "INVALID_INPUT"],
			["type A = { a: string } extends B ? C : D", "INVALID_INPUT"],
			["interface A { a: string", "INVALID_INPUT"],
			["interface A { a: string } /* open", "INVALID_INPUT"],
			["interface A { a: \\u0061 }", "INVALID_INPUT"],
			[42, "INVALID_INPUT"],
			[{ toString: () => "interface A { a: string }" }, "INVALID_INPUT"],
			["", "SCHEMA_NOT_FOUND"],
			["// only a comment", "SCHEMA_NOT_FOUND"],
			["type A = string", "SCHEMA_NOT_FOUND"],
			["interface A {}", "NO_FIELDS"],
			["interface A { id: string }", "NO_FIELDS"],
			[
				`interface A { a: ${"{ b: ".repeat(20)}string${" }".repeat(20)} }`,
				"TOO_DEEP",
			],
			[`type A = ${"(".repeat(5000)}string${")".repeat(5000)}`, "TOO_DEEP"],
			[
				`interface A { a: ${"Array<".repeat(30)}string${">".repeat(30)} }`,
				"TOO_DEEP",
			],
			[
				`interface A { a: string } // ${"x".repeat(MAX_TYPESCRIPT_SCHEMA_BYTES)}`,
				"INPUT_TOO_LARGE",
			],
		];
		for (const [input, code] of cases) {
			expect(
				errorOf(schemaFromTypeScript(input)),
				String(input).slice(0, 60),
			).toBe(code);
		}
		expect(
			errorOf(schemaFromTypeScript("type A = string", { name: "A" })),
		).toBe("UNSUPPORTED");
		expect(
			errorOf(schemaFromTypeScript("interface A { a: string }", { name: "B" })),
		).toBe("SCHEMA_NOT_FOUND");
	});

	it("reports the line of a syntax error", () => {
		const result = schemaFromTypeScript(
			"interface A {\n  a: string;\n  b: @\n}",
		);
		expect(result.ok ? "" : result.error.message).toBe(
			'Unexpected character "@" at line 3',
		);
	});
});
