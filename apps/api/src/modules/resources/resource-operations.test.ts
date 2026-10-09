import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { RecordModel } from "./record-model.js";
import { ResourceModel } from "./resource-model.js";
import {
	createProject,
	createResource,
	generate,
	readData,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_res_alice";
const BOB = "acc_res_bob";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create([
		{ sub: ALICE, username: "alice" },
		{ sub: BOB, username: "bob" },
	]);
});

describe("resource CRUD", () => {
	it("creates a resource with the default schema and endpoints", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		expect(users).toMatchObject({
			name: "users",
			parentId: null,
			parentKey: null,
			count: 0,
			template: null,
			schema: [
				{ name: "createdAt", type: "Faker.js", fakerMethod: "date.past" },
				{ name: "name", type: "Faker.js", fakerMethod: "name.fullName" },
				{ name: "avatar", type: "Faker.js", fakerMethod: "image.avatar" },
			],
		});
		expect(users.endpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
			"GET /:res",
			"GET /:res/:id",
			"POST /:res",
			"PUT /:res/:id",
			"DELETE /:res/:id",
		]);
		expect(
			users.endpoints.every((e) => e.enabled && e.response === "$mockData"),
		).toBe(true);
	});

	it("lists the tree parents first with depth and parentKey", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const tags = await createResource(ALICE, project, { name: "tags" });
		const posts = await createResource(ALICE, project, {
			name: "posts",
			parentId: users.id,
		});
		await createResource(ALICE, project, {
			name: "comments",
			parentId: posts.id,
		});
		const res = await as(ALICE).get(resourcesPath(project));
		expect(res.status).toBe(200);
		expect(
			res.body.items.map(
				(r: { name: string; depth: number; parentKey: string | null }) =>
					`${r.depth}:${r.name}:${r.parentKey}`,
			),
		).toEqual([
			"0:users:null",
			"1:posts:userId",
			"2:comments:postId",
			"0:tags:null",
		]);
		expect(tags.parentKey).toBeNull();
	});

	it("validates names, schema and template with 400 and siblings with 409", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const post = (body: object) =>
			as(ALICE).send("post", resourcesPath(project), body);
		expect((await post({ name: "../etc" })).status).toBe(400);
		const unknownMethod = await post({
			name: "x",
			schema: [{ name: "a", type: "Faker.js", fakerMethod: "helpers.fake" }],
		});
		expect(unknownMethod.status).toBe(400);
		expect(unknownMethod.body.error.message).toContain("helpers.fake");
		const badTemplate = await post({
			name: "x",
			template: { a: "$constructor.constructor" },
		});
		expect(badTemplate.status).toBe(400);
		const parentKeyClash = await post({
			name: "posts",
			parentId: users.id,
			schema: [{ name: "userId", type: "String" }],
		});
		expect(parentKeyClash.status).toBe(400);
		const duplicate = await post({ name: "users" });
		expect(duplicate.status).toBe(409);
		expect(duplicate.body.error.code).toBe("RESOURCE_NAME_TAKEN");
		expect((await post({ name: "users", parentId: users.id })).status).toBe(
			201,
		);
	});

	it("updates name, schema, template and endpoints and keeps data", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		await generate(ALICE, project, users.id, 3);
		const res = await as(ALICE).send(
			"put",
			resourcesPath(project, `/${users.id}`),
			{
				name: "people",
				schema: [
					{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
				],
				template: { email: "$internet.email" },
				endpoints: [
					{ method: "GET", path: "/:res", response: { total: "$count" } },
				],
			},
		);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ name: "people", count: 3 });
		expect(res.body.endpoints[0].response).toEqual({ total: "$count" });
		expect(res.body.endpoints[1].response).toBe("$mockData");
		expect(await readData(ALICE, project, users.id)).toHaveLength(3);
	});

	it("deletes a subtree with its records and drops Child Resource fields", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const posts = await createResource(ALICE, project, {
			name: "posts",
			parentId: users.id,
		});
		await createResource(ALICE, project, {
			name: "comments",
			parentId: posts.id,
		});
		await as(ALICE).send("put", resourcesPath(project, `/${users.id}`), {
			name: "users",
			schema: [{ name: "posts", type: "Child Resource", childId: posts.id }],
		});
		await generate(ALICE, project, users.id, 5);
		await generate(ALICE, project, posts.id, 10);

		const path = resourcesPath(project, `/${posts.id}`);
		const preview = await as(ALICE).send("delete", `${path}?dryRun=true`);
		expect(preview.body.removed.map((r: { name: string }) => r.name)).toEqual([
			"posts",
			"comments",
		]);
		expect(await ResourceModel.countDocuments()).toBe(3);

		expect((await as(ALICE).send("delete", path)).status).toBe(200);
		expect(await ResourceModel.countDocuments()).toBe(1);
		expect(
			await RecordModel.countDocuments({ resourceId: { $ne: users.id } }),
		).toBe(0);
		const left = await as(ALICE).get(resourcesPath(project, `/${users.id}`));
		expect(left.body.schema).toEqual([]);
	});
});
