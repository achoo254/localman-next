import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { dataOf, importAs } from "./testing/import-fixture.js";
import {
	createProject,
	createResource,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_alice";
useDashboardTestDb(() => ({ mockBaseDomain: "mock.test" }));
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});

describe("import_resources: names, refusals and plan limits", () => {
	it("renames a parent and its {parent}Id key in the seed records of its children", async () => {
		const projectId = await createProject(ALICE);
		const input = [{ id: "u1", name: "Ada", posts: [{ id: 7, title: "Hi" }] }];
		const res = await importAs(ALICE, projectId, {
			format: "json",
			input,
			name: "authors",
			names: { posts: "articles" },
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const [authors, articles] = res.body.created;
		expect(articles).toMatchObject({
			name: "articles",
			parentKey: "authorId",
			count: 1,
		});
		expect(authors.schema).toContainEqual({
			name: "posts",
			type: "Child Resource",
			childId: articles.id,
		});
		expect(await dataOf(ALICE, projectId, articles.id)).toEqual([
			{ id: "7", authorId: "u1", title: "Hi" },
		]);
		const unknown = await importAs(
			ALICE,
			projectId,
			{ format: "json", input, names: { nope: "x" } },
			true,
		);
		expect(unknown.status).toBe(400);
		expect(unknown.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("refuses input over 2 MB, external and looping $ref with a reason and params", async () => {
		const projectId = await createProject(ALICE);
		// Spaces need no JSON escape, so the body stays under its own limit.
		const big = `[${" ".repeat(2 * 1024 * 1024)}]`;
		const tooLarge = await importAs(
			ALICE,
			projectId,
			{ format: "json", input: big },
			true,
		);
		expect(tooLarge.status).toBe(413);
		expect(tooLarge.body.error).toMatchObject({
			code: "SCHEMA_IMPORT_FAILED",
			details: { reason: "INPUT_TOO_LARGE", max: 2 * 1024 * 1024 },
		});
		const doc = (schemas: object) => ({
			openapi: "3.1.0",
			info: {},
			components: { schemas },
		});
		const external = await importAs(ALICE, projectId, {
			format: "openapi",
			input: doc({
				A: {
					type: "object",
					properties: { b: { $ref: "https://evil.test/b.json" } },
				},
			}),
		});
		expect(external.status).toBe(400);
		expect(external.body.error.details).toEqual({
			reason: "EXTERNAL_REF",
			ref: "https://evil.test/b.json",
		});
		const loop = await importAs(ALICE, projectId, {
			format: "openapi",
			input: doc({
				A: { $ref: "#/components/schemas/B" },
				B: { $ref: "#/components/schemas/A" },
			}),
		});
		expect(loop.status).toBe(400);
		expect(loop.body.error.details).toMatchObject({ reason: "REF_CYCLE" });
		expect(loop.body.error.details.cycle).toMatch(/→/);
		const missing = await importAs(
			ALICE,
			projectId,
			{
				format: "openapi",
				input: doc({
					A: { type: "object", properties: { a: { type: "string" } } },
				}),
				schema: "Nope",
			},
			true,
		);
		expect(missing.body.error.details).toEqual({
			reason: "SCHEMA_NOT_FOUND",
			name: "Nope",
		});
		const quote = await importAs(
			ALICE,
			projectId,
			{ format: "csv", input: 'a\n"open' },
			true,
		);
		expect(quote.body.error.details).toEqual({ reason: "CSV_QUOTE", row: 1 });
		const items = await as(ALICE).get(resourcesPath(projectId));
		expect(items.body.items).toEqual([]);
	});

	it("accepts 2 MB of CSV whose JSON escapes double the body", async () => {
		const projectId = await createProject(ALICE);
		const row = `"${'""'.repeat(400)}"\n`;
		const rows = Math.floor((2 * 1024 * 1024 - 8) / row.length);
		const csv = `quote\n${row.repeat(rows)}`;
		expect(JSON.stringify(csv).length).toBeGreaterThan(3.9 * 1024 * 1024);
		const preview = await importAs(
			ALICE,
			projectId,
			{ format: "csv", input: csv, name: "quotes" },
			true,
		);
		expect(preview.status, JSON.stringify(preview.body).slice(0, 200)).toBe(
			200,
		);
		expect(preview.body.resources[0]).toMatchObject({ name: "quotes" });
	});

	it("keeps the owner's plan limit and creates nothing past it", async () => {
		const projectId = await createProject(ALICE);
		for (let i = 0; i < 9; i += 1) {
			await createResource(ALICE, projectId, { name: `r${i}` });
		}
		const body = {
			format: "json",
			input: [{ name: "Ada", posts: [{ title: "Hi" }] }],
		};
		const preview = await importAs(ALICE, projectId, body, true);
		expect(preview.body).toMatchObject({ resourcesLeft: 1 });
		expect(preview.body.resources).toHaveLength(2);
		const refused = await importAs(ALICE, projectId, body);
		expect(refused.status).toBe(403);
		expect(refused.body.error.code).toBe("PLAN_LIMIT_REACHED");
		const items = await as(ALICE).get(resourcesPath(projectId));
		expect(items.body.items).toHaveLength(9);
	});
});
