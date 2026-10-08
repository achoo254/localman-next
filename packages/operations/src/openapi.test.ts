import { describe, expect, it } from "vitest";
import { sampleOperations } from "./__fixtures__/sample-operations.js";
import { buildOpenApiDocument } from "./openapi.js";

const doc = buildOpenApiDocument(
	sampleOperations,
	{ title: "Localman API", version: "1.0.0" },
	[{ url: "/api/v1" }],
);

describe("buildOpenApiDocument", () => {
	it("produces an OpenAPI 3.1 document with converted paths", () => {
		expect(doc.openapi).toBe("3.1.0");
		expect(doc.info).toEqual({ title: "Localman API", version: "1.0.0" });
		expect(doc.servers).toEqual([{ url: "/api/v1" }]);
		expect(Object.keys(doc.paths).sort()).toEqual([
			"/extension/download",
			"/projects/{projectId}",
			"/projects/{projectId}/resources",
			"/projects/{projectId}/resources/{resourceId}",
		]);
		expect(doc.components.schemas.Error).toMatchObject({ required: ["error"] });
	});

	it("maps GET inputs to path and query parameters", () => {
		const op = doc.paths["/projects/{projectId}/resources/{resourceId}"]?.get;
		expect(op?.operationId).toBe("mock.getResource");
		expect(op?.tags).toEqual(["mock"]);
		expect(op?.parameters).toEqual([
			{
				name: "projectId",
				in: "path",
				required: true,
				schema: expect.any(Object),
			},
			{
				name: "resourceId",
				in: "path",
				required: true,
				schema: expect.any(Object),
			},
			{
				name: "expand",
				in: "query",
				required: false,
				schema: expect.any(Object),
			},
		]);
		expect(op?.requestBody).toBeUndefined();
		expect(Object.keys(op?.responses ?? {}).sort()).toEqual([
			"200",
			"400",
			"401",
			"403",
			"500",
		]);
		expect(op?.["x-mcp"]).toEqual({
			tool: "get_resource",
			toolset: "mock",
			dryRun: false,
		});
		expect(op?.["x-scopes"]).toEqual(["mock:read"]);
	});

	it("maps POST inputs to a JSON request body and honours successStatus", () => {
		const op = doc.paths["/projects/{projectId}/resources"]?.post;
		expect(op?.parameters?.map((p) => p.name)).toEqual(["projectId"]);
		expect(op?.requestBody).toMatchObject({
			required: true,
			content: {
				"application/json": {
					schema: { type: "object", required: ["name"] },
				},
			},
		});
		expect(op?.responses).toHaveProperty("201");
		expect(op?.responses).not.toHaveProperty("200");
	});

	it("documents dry-run and MCP exemptions", () => {
		const del = doc.paths["/projects/{projectId}"]?.delete;
		expect(del?.parameters).toContainEqual({
			name: "dryRun",
			in: "query",
			required: false,
			schema: { type: "boolean", default: false },
		});
		const download = doc.paths["/extension/download"]?.get;
		expect(download?.["x-mcp"]).toEqual({
			exempt: "Browser extension utility; useless to an agent",
		});
		expect(download?.responses).not.toHaveProperty("401");
	});
});
