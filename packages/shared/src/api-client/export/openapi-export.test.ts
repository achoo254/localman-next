import { describe, expect, it } from "vitest";
import { importText } from "../import/import-text.js";
import { flattenImportedRequests } from "../import/imported-collection.js";
import { SHOP_TREE } from "./export-test-fixtures.js";
import { exportOpenApi, splitRequestUrl } from "./openapi-export.js";

describe("splitRequestUrl", () => {
	it("splits server and templated path", () => {
		expect(splitRequestUrl("https://a.com:8080/x/{{ id }}?q=1#f")).toEqual({
			server: "https://a.com:8080",
			path: "/x/{id}",
		});
		expect(splitRequestUrl("{{baseUrl}}")).toEqual({
			server: "{baseUrl}",
			path: "/",
		});
		expect(splitRequestUrl("/relative")).toEqual({
			server: "",
			path: "/relative",
		});
	});
});

describe("exportOpenApi", () => {
	const { document, skipped } = exportOpenApi(SHOP_TREE);

	it("writes an OpenAPI 3.0.3 document with servers and security schemes", () => {
		expect(skipped).toBe(1);
		expect(document.openapi).toBe("3.0.3");
		expect(document.info).toEqual({
			title: "Shop",
			version: "1.0.0",
			description: "Shop API",
		});
		expect(document.servers).toEqual([
			{
				url: "{baseUrl}",
				variables: { baseUrl: { default: "https://api.example.com" } },
			},
		]);
		expect(document.components).toEqual({
			securitySchemes: {
				bearerAuth: { type: "http", scheme: "bearer" },
				"apiKey_header_X-Key": { type: "apiKey", in: "header", name: "X-Key" },
			},
		});
	});

	it("describes parameters, bodies and per-operation servers", () => {
		expect(document.paths).toEqual({
			"/users/{id}": {
				get: {
					summary: "Get user",
					tags: ["users"],
					parameters: [
						{
							name: "id",
							in: "path",
							required: true,
							schema: { type: "string" },
						},
						{
							name: "expand",
							in: "query",
							required: false,
							schema: { type: "string" },
							example: "1",
						},
						{
							name: "debug",
							in: "query",
							required: false,
							schema: { type: "string" },
							example: "true",
						},
						{
							name: "X-Trace",
							in: "header",
							required: false,
							schema: { type: "string" },
							example: "abc",
						},
					],
					responses: { "200": { description: "OK" } },
					security: [{ bearerAuth: [] }],
				},
			},
			"/users": {
				post: {
					summary: "Create user",
					tags: ["users"],
					requestBody: {
						content: {
							"application/vnd.api+json": { example: { name: "Ann" } },
						},
					},
					responses: { "200": { description: "OK" } },
					security: [{ "apiKey_header_X-Key": [] }],
				},
			},
			"/upload": {
				put: {
					summary: "Upload",
					requestBody: {
						content: {
							"multipart/form-data": {
								schema: {
									type: "object",
									properties: {
										caption: { type: "string", example: "me" },
										file: { type: "string", format: "binary" },
									},
								},
							},
						},
					},
					responses: { "200": { description: "OK" } },
					security: [],
					servers: [{ url: "https://files.example.com" }],
				},
			},
		});
	});

	it("imports back into equivalent requests", () => {
		const result = importText(JSON.stringify(document));
		if (!result.ok || result.value.format === "environment-v21") {
			throw new Error("re-import failed");
		}
		const requests = flattenImportedRequests(result.value);
		expect(
			requests.map((r) => [r.draft.method, r.draft.url, r.inheritedAuth.type]),
		).toEqual([
			["GET", "{{baseUrl}}/users/{{id}}", "none"],
			["POST", "{{baseUrl}}/users", "none"],
			["PUT", "{{baseUrl}}/upload", "none"],
		]);
		expect(requests[0].draft.auth).toEqual({ type: "bearer", token: "" });
		expect(requests[1].draft.auth).toEqual({
			type: "apikey",
			key: "X-Key",
			value: "",
			in: "header",
		});
		expect(JSON.parse(requests[1].draft.body.raw)).toEqual({ name: "Ann" });
		expect(result.value.variables[0].value).toBe("https://api.example.com");
	});
});
