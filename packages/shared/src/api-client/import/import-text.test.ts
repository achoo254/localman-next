import { describe, expect, it } from "vitest";
import { MAX_IMPORT_ITEMS, MAX_IMPORT_WARNINGS } from "./import-context.js";
import { MAX_IMPORT_BYTES } from "./import-json.js";
import { importCollection } from "./import-test-utils.js";
import { importText } from "./import-text.js";
import {
	countImportedRequests,
	flattenImportedRequests,
} from "./imported-collection.js";

const SCHEMA =
	"https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

const errorCode = (text: string): string | null => {
	const result = importText(text);
	return result.ok ? null : result.error.code;
};

describe("importText: format detection", () => {
	it("imports a cURL command as a one-request collection", () => {
		const imported = importCollection("curl https://api.example.com/users?x=1");
		expect(imported.format).toBe("curl");
		expect(imported.name).toBe("https://api.example.com/users");
		expect(flattenImportedRequests(imported).map((r) => r.draft.url)).toEqual([
			"https://api.example.com/users?x=1",
		]);
	});

	it("names what it cannot read", () => {
		expect(errorCode("")).toBe("EMPTY_INPUT");
		expect(errorCode("{ not json")).toBe("INVALID_JSON");
		expect(errorCode("hello world")).toBe("UNKNOWN_FORMAT");
		expect(errorCode('{"hello":"world"}')).toBe("UNKNOWN_FORMAT");
		expect(errorCode("[1,2]")).toBe("UNKNOWN_FORMAT");
		expect(errorCode("info:\n  name: x")).toBe("YAML_NOT_SUPPORTED");
		expect(errorCode('{"id":"x","name":"Old","order":[],"requests":[]}')).toBe(
			"UNSUPPORTED_VERSION",
		);
		expect(
			errorCode(
				'{"info":{"schema":"https://schema.example/collection/v1.0.0/x.json"},"item":[]}',
			),
		).toBe("UNSUPPORTED_VERSION");
		expect(errorCode(`{"info":{"schema":"${SCHEMA}"}}`)).toBe(
			"INVALID_DOCUMENT",
		);
		expect(errorCode('{"name":"Env","values":[1]}')).toBe("INVALID_DOCUMENT");
	});
});

describe("importText: hostile input", () => {
	it("refuses input over 10 MB before parsing", () => {
		const result = importText(`{"a":"${"x".repeat(MAX_IMPORT_BYTES)}"}`);
		expect(result).toEqual({
			ok: false,
			error: { code: "INPUT_TOO_LARGE", params: { max: MAX_IMPORT_BYTES } },
		});
	});

	it("refuses deeply nested JSON without overflowing the stack", () => {
		const deep = `${'{"a":'.repeat(5000)}1${"}".repeat(5000)}`;
		expect(errorCode(deep)).toBe("TOO_COMPLEX");
		expect(errorCode(`${"[".repeat(5000)}${"]".repeat(5000)}`)).toBe(
			"TOO_COMPLEX",
		);
	});

	it("does not let __proto__ or constructor keys reach a prototype", () => {
		const text = JSON.stringify({
			info: { name: "x", schema: SCHEMA, ["__proto__"]: { polluted: true } },
			["__proto__"]: { polluted: true },
			constructor: { prototype: { polluted: true } },
			item: [
				{
					name: "__proto__",
					request: {
						method: "GET",
						url: "https://a.com",
						header: [
							{ key: "__proto__", value: "x" },
							{ key: { a: 1 }, value: "y" },
						],
					},
				},
			],
			variable: [{ key: "__proto__", value: "v" }],
		});
		expect(text).toContain('"__proto__":{"polluted":true}');
		const imported = importCollection(text);
		const [request] = flattenImportedRequests(imported);
		expect(request.draft.headers.map((h) => [h.key, h.value])).toEqual([
			["__proto__", "x"],
		]);
		expect(imported.variables[0]).toEqual({
			key: "__proto__",
			value: "v",
			secret: false,
			enabled: true,
		});
		expect(Object.prototype).not.toHaveProperty("polluted");
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it("keeps a schema property named __proto__ as a plain key", () => {
		const doc = `{"openapi":"3.0.0","info":{"title":"t"},"paths":{"/x":{"post":{"requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"__proto__":{"type":"string"},"ok":{"$ref":"#/__proto__"}}}}}}}}}}`;
		const imported = importCollection(doc);
		const [request] = flattenImportedRequests(imported);
		const example: unknown = JSON.parse(request.draft.body.raw);
		expect(example).toEqual(JSON.parse('{"__proto__":"string","ok":null}'));
		expect(imported.warnings.map((w) => w.code)).toEqual(["UNRESOLVED_REF"]);
		expect(Object.prototype).not.toHaveProperty("string");
	});

	it("caps the number of requests and warnings", () => {
		const item = Array.from({ length: MAX_IMPORT_ITEMS + 50 }, (_, i) => ({
			name: `r${i}`,
			request: { method: "GET", url: "https://a.com", auth: { type: "hawk" } },
		}));
		const imported = importCollection(
			JSON.stringify({ info: { name: "big", schema: SCHEMA }, item }),
		);
		expect(countImportedRequests(imported.items)).toBe(MAX_IMPORT_ITEMS);
		expect(imported.warnings).toHaveLength(MAX_IMPORT_WARNINGS + 1);
		expect(imported.warnings.at(-1)).toEqual({
			code: "MORE_WARNINGS",
			path: "",
			params: { count: MAX_IMPORT_ITEMS - MAX_IMPORT_WARNINGS + 1 },
		});
	});

	it("ignores fields of the wrong type instead of failing", () => {
		const text = JSON.stringify({
			info: { name: 7, schema: SCHEMA },
			item: [
				null,
				"text",
				{
					name: "ok",
					request: { method: 12, url: { raw: ["x"] }, header: "X-A: 1\nbad" },
				},
			],
		});
		const imported = importCollection(text);
		expect(imported.name).toBe("7");
		const [request] = flattenImportedRequests(imported);
		expect(request.draft.method).toBe("GET");
		expect(request.draft.headers.map((h) => [h.key, h.value])).toEqual([
			["X-A", "1"],
		]);
	});
});
