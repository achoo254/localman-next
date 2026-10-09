import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv-parser.js";
import { MAX_RECORDS_PER_RESOURCE } from "./resource-constants.js";
import { CSV_TYPE_ROWS } from "./schema-inference-csv.js";
import { resourcesOf } from "./schema-inference-test-utils.js";
import { inferSchema } from "./schema-inference.js";

describe("parseCsv", () => {
	it("reads quotes, escaped quotes, line breaks in quotes and every line end", () => {
		const text =
			'\uFEFFa,b,c\r\n"x, y","say ""hi""","line 1\nline 2"\r\n\n1,,"" \r3,"q"tail,4';
		expect(parseCsv(text)).toEqual({
			rows: [
				["a", "b", "c"],
				["x, y", 'say "hi"', "line 1\nline 2"],
				["1", "", " "],
				["3", "qtail", "4"],
			],
			truncated: false,
		});
	});

	it("stops after maxRows and reports an unterminated quote", () => {
		expect(parseCsv("a\nb\nc\n", 2)).toEqual({
			rows: [["a"], ["b"]],
			truncated: true,
		});
		expect(parseCsv("a\nb\n\n\n", 2).truncated).toBe(false);
		expect(() => parseCsv('a,"open\nb')).toThrow(/never closed/);
	});
});

describe("inferSchema from CSV", () => {
	it("types columns, strips the BOM and keeps commas inside quotes", () => {
		const csv = [
			"\uFEFFid,Full Name,email,c_num,c_bool,c_date,c_code,c_free",
			'1,"Nguyen, An",an@example.com,30,true,2024-01-02,007,"He said ""ok"""',
			'2,Binh,binh@example.com,41.5,FALSE,2024-02-03,100,"two\nlines"',
			"3,Chi,chi@example.com,,true,2024-03-04,200,",
		].join("\r\n");
		const result = inferSchema(csv, { name: "people" });
		const [people] = resourcesOf(result);
		expect(people?.name).toBe("people");
		expect(people?.fields.map((field) => field.name)[0]).toBe("Full_Name");
		expect(people?.fields.slice(1)).toEqual([
			{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
			{ name: "c_num", type: "Number" },
			{ name: "c_bool", type: "Boolean" },
			{ name: "c_date", type: "Date" },
			{ name: "c_code", type: "String" },
			{ name: "c_free", type: "String" },
		]);
		expect(people?.records?.[0]).toEqual({
			id: 1,
			Full_Name: "Nguyen, An",
			email: "an@example.com",
			c_num: 30,
			c_bool: true,
			c_date: "2024-01-02",
			c_code: "007",
			c_free: 'He said "ok"',
		});
		expect(people?.records?.[1]).toMatchObject({
			c_bool: false,
			c_num: 41.5,
			c_free: "two\nlines",
		});
		expect(people?.records?.[2]).toMatchObject({ c_num: null, c_free: null });
	});

	it("warns about rows with missing or extra cells", () => {
		const result = inferSchema("a,b\n1,2\n3\n4,5,6\n", { format: "csv" });
		const [items] = resourcesOf(result);
		expect(items?.records).toEqual([
			{ id: "1", a: 1, b: 2 },
			{ id: "2", a: 3, b: null },
			{ id: "3", a: 4, b: 5 },
		]);
		expect(result.ok && result.warnings).toEqual([
			{
				path: "items",
				code: "CSV_ROW_CELLS",
				params: { row: 2, found: 1, expected: 2 },
				message: "Row 2 has 1 cells instead of 2; missing cells are empty",
			},
			{
				path: "items",
				code: "CSV_ROW_CELLS",
				params: { row: 3, found: 3, expected: 2 },
				message: "Row 3 has 3 cells instead of 2; extra cells are ignored",
			},
		]);
	});

	it("guesses types from the first rows only and caps rows and columns", () => {
		const rows = Array.from({ length: CSV_TYPE_ROWS }, (_, i) => `${i}`);
		const [late] = resourcesOf(inferSchema(["n", ...rows, "abc"].join("\n")));
		expect(late?.fields).toEqual([{ name: "n", type: "Number" }]);
		expect(late?.records?.at(-1)).toEqual({ id: "101", n: "abc" });
		const many = Array.from(
			{ length: MAX_RECORDS_PER_RESOURCE + 10 },
			() => "x",
		);
		const capped = inferSchema(["v", ...many].join("\n"));
		expect(resourcesOf(capped)[0]?.records).toHaveLength(
			MAX_RECORDS_PER_RESOURCE,
		);
		expect(capped.ok && capped.warnings[0]?.message).toMatch(/first 1000 rows/);
		const header = Array.from({ length: 70 }, (_, i) => `c${i}`).join(",");
		expect(resourcesOf(inferSchema(header))[0]?.fields).toHaveLength(50);
	});

	it("skips forbidden and repeated headers and refuses bad CSV", () => {
		const result = inferSchema("__proto__,name,name,constructor\n1,a,b,2");
		const [items] = resourcesOf(result);
		expect(items?.fields.map((f) => f.name)).toEqual(["name"]);
		expect(items?.records).toEqual([{ id: "1", name: "a" }]);
		expect(Object.getPrototypeOf(items?.records?.[0])).toBe(Object.prototype);
		const errors = [
			inferSchema("", { format: "csv" }),
			inferSchema('a\n"x', { format: "csv" }),
			inferSchema({ a: 1 }, { format: "csv" }),
			inferSchema("a\n\uFFFD", { format: "csv" }),
		];
		expect(errors.map((r) => (r.ok ? "ok" : r.error.code))).toEqual([
			"CSV_EMPTY",
			"CSV_QUOTE",
			"INVALID_INPUT",
			"ENCODING",
		]);
		expect(errors[1]?.ok === false && errors[1].error.params).toEqual({
			row: 1,
		});
	});
});
