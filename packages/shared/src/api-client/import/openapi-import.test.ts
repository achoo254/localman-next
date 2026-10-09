import { describe, expect, it } from "vitest";
import { importCollection, readFixture } from "./import-test-utils.js";
import { importText } from "./import-text.js";
import { flattenImportedRequests } from "./imported-collection.js";

const fixture = readFixture("openapi-sample.json");
describe("OpenAPI import", () => {
	const imported = importCollection(fixture);
	const flat = flattenImportedRequests(imported);
	const byName = (name: string) => {
		const found = flat.find((r) => r.name === name);
		if (!found) throw new Error(`no request ${name}`);
		return found.draft;
	};

	it("uses the first server as {{baseUrl}} and the global security", () => {
		expect(imported.format).toBe("openapi");
		expect(imported.name).toBe("Pet Store");
		expect(imported.description).toBe("Sample pets API.");
		expect(imported.variables).toEqual([
			{
				key: "baseUrl",
				value: "https://api.example.com/v1",
				secret: false,
				enabled: true,
			},
		]);
		expect(imported.auth).toEqual({ type: "bearer", token: "" });
	});

	it("groups operations by first tag, in the document's tag order", () => {
		expect(flat.map((r) => [r.folderPath.join("/"), r.name])).toEqual([
			["users", "Upload avatar"],
			["pets", "List pets"],
			["pets", "createPet"],
			["pets", "Get a pet"],
			["", "DELETE /pets/{petId}"],
			["", "Log in"],
		]);
		const pets = imported.items.find(
			(i) => i.kind === "folder" && i.name === "pets",
		);
		expect(pets?.description).toBe("Everything about pets");
	});

	it("fills query, header and cookie parameters from examples", () => {
		const list = byName("List pets");
		expect(list.url).toBe("{{baseUrl}}/pets?limit=20");
		expect(list.params.map((p) => [p.key, p.value, p.enabled])).toEqual([
			["limit", "20", true],
			["tag", "a,b", false],
		]);
		expect(list.headers.map((h) => [h.key, h.value, h.enabled])).toEqual([
			["X-Trace-Id", "", true],
			["Cookie", "session=abc", true],
		]);
		expect(list.auth).toEqual({ type: "inherit" });
	});

	it("fills path parameters, or leaves them as variables", () => {
		expect(byName("Get a pet").url).toBe("{{baseUrl}}/pets/p%201");
		expect(byName("Upload avatar").url).toBe("{{baseUrl}}/users/7/avatar");
		expect(byName("DELETE /pets/{petId}").url).toBe(
			"{{baseUrl}}/pets/{{petId}}",
		);
	});

	it("maps operation security", () => {
		expect(byName("Get a pet").auth).toEqual({ type: "none" });
		expect(byName("DELETE /pets/{petId}").auth).toEqual({
			type: "apikey",
			key: "X-API-Key",
			value: "",
			in: "header",
		});
	});

	it("builds a JSON example from the schema, stopping at cycles", () => {
		const create = byName("createPet");
		expect(create.method).toBe("POST");
		expect(create.body.rawLanguage).toBe("json");
		// Path-level parameter only: JSON is implied, so no Content-Type row.
		expect(create.headers.map((h) => h.key)).toEqual(["X-Trace-Id"]);
		expect(JSON.parse(create.body.raw)).toEqual({
			id: 1,
			name: "Rex",
			born: "2026-01-01",
			status: "available",
			owner: { email: "user@example.com", vip: true },
			tags: ["string"],
			parent: null,
			remote: null,
		});
	});

	it("builds form bodies", () => {
		expect(
			byName("Upload avatar").body.formData.map((r) => [
				r.key,
				r.kind,
				r.value,
			]),
		).toEqual([
			["caption", "text", "me"],
			["file", "file", ""],
		]);
		expect(
			byName("Log in").body.urlencoded.map((r) => [r.key, r.value]),
		).toEqual([
			["user", "ann"],
			["remember", "true"],
		]);
	});

	it("reports external references and unsupported methods", () => {
		expect(imported.warnings.map((w) => [w.code, w.path, w.params])).toEqual([
			[
				"UNRESOLVED_REF",
				"pets / POST /pets",
				{ ref: "https://example.com/schemas/remote.json" },
			],
			["UNSUPPORTED_METHOD", "TRACE /pets/{petId}", { method: "TRACE" }],
		]);
	});

	it("reads OpenAPI 3.0 with a content type the body does not imply", () => {
		const doc = {
			openapi: "3.0.3",
			info: { title: "T", version: "1" },
			paths: {
				"/items": {
					patch: {
						requestBody: {
							content: {
								"application/merge-patch+json": { example: { name: "x" } },
							},
						},
						responses: {},
					},
				},
			},
		};
		const [request] = flattenImportedRequests(
			importCollection(JSON.stringify(doc)),
		);
		expect(request.draft.method).toBe("PATCH");
		expect(request.draft.url).toBe("{{baseUrl}}/items");
		expect(request.draft.headers.map((h) => [h.key, h.value])).toEqual([
			["Content-Type", "application/merge-patch+json"],
		]);
		expect(request.inheritedAuth).toEqual({ type: "none" });
	});
});

describe("OpenAPI versions and formats", () => {
	it("refuses Swagger 2, OpenAPI 4 and YAML with their own codes", () => {
		expect(importText('{"swagger":"2.0","paths":{}}')).toEqual({
			ok: false,
			error: {
				code: "UNSUPPORTED_VERSION",
				params: { version: "Swagger 2.0" },
			},
		});
		expect(importText('{"openapi":"4.0.0"}')).toMatchObject({
			error: {
				code: "UNSUPPORTED_VERSION",
				params: { version: "OpenAPI 4.0.0" },
			},
		});
		expect(importText("openapi: 3.0.0\ninfo:\n  title: x\n")).toMatchObject({
			error: { code: "YAML_NOT_SUPPORTED" },
		});
		expect(importText("# spec\n---\nopenapi: 3.1.0\n")).toMatchObject({
			error: { code: "YAML_NOT_SUPPORTED" },
		});
	});
});
