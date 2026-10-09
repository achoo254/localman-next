import { describe, expect, it } from "vitest";
import { extractUsedVariables } from "./extract-variables.js";
import {
	type ApiRequestDraft,
	type RequestBody,
	createRequestDraft,
	emptyRequestBody,
} from "./request-model.js";

function makeRequest(
	overrides: Partial<ApiRequestDraft> = {},
): ApiRequestDraft {
	return createRequestDraft({ url: "", ...overrides });
}

function body(overrides: Partial<RequestBody>): RequestBody {
	return { ...emptyRequestBody(), ...overrides };
}

const row = (id: string, key: string, value: string, enabled = true) => ({
	id,
	key,
	value,
	enabled,
});

describe("extractUsedVariables", () => {
	it("returns empty for null", () => {
		expect(extractUsedVariables(null)).toEqual([]);
	});

	it("extracts vars from url only", () => {
		const req = makeRequest({ url: "{{baseUrl}}/users/{{userId}}" });
		expect(extractUsedVariables(req)).toEqual(["baseUrl", "userId"]);
	});

	it("preserves first-appearance order and dedupes", () => {
		const req = makeRequest({
			url: "{{baseUrl}}/{{baseUrl}}/{{id}}",
			headers: [row("h1", "{{id}}", "{{token}}")],
		});
		expect(extractUsedVariables(req)).toEqual(["baseUrl", "id", "token"]);
	});

	it("extracts from params and headers", () => {
		const req = makeRequest({
			url: "/a",
			params: [row("p1", "q", "{{q}}")],
			headers: [row("h1", "X-Env", "{{env}}")],
		});
		expect(extractUsedVariables(req)).toEqual(["q", "env"]);
	});

	it("extracts from a raw JSON body", () => {
		const req = makeRequest({
			body: body({
				type: "raw",
				raw: '{"id": "{{userId}}", "name": "{{name}}"}',
			}),
		});
		expect(extractUsedVariables(req)).toEqual(["userId", "name"]);
	});

	it("extracts from form-data text rows, not file rows", () => {
		const req = makeRequest({
			body: body({
				type: "formdata",
				formData: [
					{ ...row("f1", "note", "{{path}}"), kind: "text" },
					{ ...row("f2", "{{field}}", "{{ignored}}"), kind: "file" },
				],
			}),
		});
		expect(extractUsedVariables(req)).toEqual(["path", "field"]);
	});

	it("extracts from url-encoded rows", () => {
		const req = makeRequest({
			body: body({ type: "urlencoded", urlencoded: [row("f1", "k", "{{v}}")] }),
		});
		expect(extractUsedVariables(req)).toEqual(["v"]);
	});

	it("scans only the active body type", () => {
		const req = makeRequest({
			body: body({ type: "none", raw: "{{hidden}}" }),
		});
		expect(extractUsedVariables(req)).toEqual([]);
	});

	it("extracts the bearer token", () => {
		const req = makeRequest({ auth: { type: "bearer", token: "{{tok}}" } });
		expect(extractUsedVariables(req)).toEqual(["tok"]);
	});

	it("extracts basic auth username and password", () => {
		const req = makeRequest({
			auth: { type: "basic", username: "{{u}}", password: "{{p}}" },
		});
		expect(extractUsedVariables(req)).toEqual(["u", "p"]);
	});

	it("extracts api key name and value", () => {
		const req = makeRequest({
			auth: {
				type: "apikey",
				key: "{{hname}}",
				value: "{{hval}}",
				in: "query",
			},
		});
		expect(extractUsedVariables(req)).toEqual(["hname", "hval"]);
	});

	it("skips empty {{}}", () => {
		const req = makeRequest({ url: "/{{}}/{{valid}}" });
		expect(extractUsedVariables(req)).toEqual(["valid"]);
	});

	it("still scans a body over 100 KB, so a secret in it is found", () => {
		const big = `${"x".repeat(100_001)}{{secretToken}}`;
		const req = makeRequest({ body: body({ type: "raw", raw: big }) });
		expect(extractUsedVariables(req)).toEqual(["secretToken"]);
	});

	it("returns empty when no vars", () => {
		const req = makeRequest({ url: "https://api.example.com/users" });
		expect(extractUsedVariables(req)).toEqual([]);
	});
});
