import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";

const ALICE = "acc_alice";
const BOB = "acc_bob";
const PUBLIC_URL = "https://localman.test";

useDashboardTestDb(() => ({
	mockBaseDomain: "mock.test",
	publicUrl: PUBLIC_URL,
}));

beforeEach(async () => {
	await UserModel.create([
		{ sub: ALICE, username: "alice" },
		{ sub: BOB, username: "bob" },
	]);
});

async function createProject(sub: string) {
	const res = await as(sub).send("post", "/projects", { name: "Shop" });
	expect(res.status).toBe(201);
	return res.body as { id: string; secret: string; uiUrl: string };
}

const OPENAPI = {
	openapi: "3.1.0",
	info: { title: "Shop", version: "1" },
	paths: {},
	components: {
		schemas: {
			Order: {
				type: "object",
				properties: { total: { type: "number" }, note: { type: "string" } },
			},
			Customer: {
				type: "object",
				properties: {
					email: { type: "string", format: "email" },
					vip: { type: "boolean" },
				},
			},
		},
	},
};

describe("create_resource_from_schema (POST …/resources/from-schema)", () => {
	it("creates the resource from a chosen OpenAPI component and links the UI", async () => {
		const project = await createProject(ALICE);
		const res = await as(ALICE).send(
			"post",
			`/projects/${project.id}/resources/from-schema`,
			{
				name: "customers",
				format: "openapi",
				source: OPENAPI,
				schemaName: "Customer",
			},
		);
		expect(res.status).toBe(201);
		expect(res.body.importedFrom).toBe("Customer");
		expect(res.body.uiUrl).toBe(`${PUBLIC_URL}/projects/${project.id}`);
		expect(project.uiUrl).toBe(res.body.uiUrl);
		const fields = res.body.resource.schema as { name: string; type: string }[];
		expect(fields.map((field) => [field.name, field.type])).toEqual([
			["email", "Faker.js"],
			["vip", "Boolean"],
		]);
	});

	it("takes a JSON Schema object", async () => {
		const project = await createProject(ALICE);
		const res = await as(ALICE).send(
			"post",
			`/projects/${project.id}/resources/from-schema`,
			{
				name: "items",
				format: "json-schema",
				source: { type: "object", properties: { title: { type: "string" } } },
			},
		);
		expect(res.status).toBe(201);
		const fields = res.body.resource.schema as { name: string }[];
		expect(fields.map((field) => field.name)).toEqual(["title"]);
	});

	it.each([
		["TypeScript without a type", "typescript", "const x = 1;"],
		["TypeScript sent as an object", "typescript", { type: "object" }],
		["OpenAPI that is not JSON", "openapi", "openapi: 3.1.0"],
	])("refuses %s with SCHEMA_IMPORT_FAILED", async (_label, format, source) => {
		const project = await createProject(ALICE);
		const res = await as(ALICE).send(
			"post",
			`/projects/${project.id}/resources/from-schema`,
			{ name: "things", format, source },
		);
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("SCHEMA_IMPORT_FAILED");
		expect(res.body.error.details.reason).toEqual(expect.any(String));
	});

	it("answers 404 for a project the caller cannot read", async () => {
		const project = await createProject(ALICE);
		const res = await as(BOB).send(
			"post",
			`/projects/${project.id}/resources/from-schema`,
			{
				name: "users",
				format: "typescript",
				source: "interface U { a: string }",
			},
		);
		expect(res.status).toBe(404);
	});
});

describe("get_mock_urls (GET …/mock-urls)", () => {
	it("lists nested collection URLs and the enabled methods only", async () => {
		const project = await createProject(ALICE);
		const path = `/projects/${project.id}/resources`;
		const users = await as(ALICE).send("post", path, { name: "users" });
		const posts = await as(ALICE).send("post", path, {
			name: "posts",
			parentId: users.body.id,
			endpoints: [
				{ method: "GET", path: "/:res" },
				{ method: "PUT", path: "/:res/:id" },
				{ method: "DELETE", path: "/:res/:id", enabled: false },
			],
		});
		expect(posts.status).toBe(201);

		const res = await as(ALICE).get(`/projects/${project.id}/mock-urls`);
		expect(res.status).toBe(200);
		const base = `https://${project.secret}.mock.test`;
		expect(res.body).toMatchObject({
			mockBaseUrl: base,
			mcpUrl: `${base}/mcp`,
			uiUrl: `${PUBLIC_URL}/projects/${project.id}`,
		});
		const [root, child] = res.body.resources;
		expect(root).toMatchObject({
			name: "users",
			depth: 0,
			collectionUrl: `${base}/users`,
		});
		const nested = `${base}/users/{userId}/posts`;
		expect(child).toMatchObject({
			name: "posts",
			depth: 1,
			collectionUrl: nested,
		});
		const methods = (child.endpoints as { method: string; url: string }[]).map(
			(endpoint) => `${endpoint.method} ${endpoint.url}`,
		);
		expect(methods).not.toContain(`DELETE ${nested}/{id}`);
		expect(methods).toEqual(
			expect.arrayContaining([
				`PUT ${nested}/{id}`,
				`PATCH ${nested}/{id}`,
				`GET ${nested}`,
			]),
		);
	});

	it("answers 404 to someone without access", async () => {
		const project = await createProject(ALICE);
		const res = await as(BOB).get(`/projects/${project.id}/mock-urls`);
		expect(res.status).toBe(404);
	});
});
