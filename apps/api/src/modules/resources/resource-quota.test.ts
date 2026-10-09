import { limitsFor } from "@localman/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { ProjectModel } from "../projects/project-model.js";
import { UserModel } from "../users/user-model.js";
import { ResourceModel } from "./resource-model.js";
import {
	createProject,
	createResource,
	generate,
	readData,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_quota_alice";
const BOB = "acc_quota_bob";
const FREE_MAX = limitsFor("free").resources;

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create([
		{ sub: ALICE, username: "alice" },
		{ sub: BOB, username: "bob" },
	]);
});

const post = (sub: string, project: string, name: string) =>
	as(sub).send("post", resourcesPath(project), { name });

describe("resource quota", () => {
	it("counts resources over every owned project and answers 403 at the limit", async () => {
		const first = await createProject(ALICE, "One");
		const second = await createProject(ALICE, "Two");
		for (let i = 0; i < FREE_MAX; i += 1) {
			const res = await post(ALICE, i % 2 === 0 ? first : second, `r${i}`);
			expect(res.status).toBe(201);
		}
		const blocked = await post(ALICE, second, "extra");
		expect(blocked.status).toBe(403);
		expect(blocked.body.error).toMatchObject({
			code: "PLAN_LIMIT_REACHED",
			details: { limit: "resources", max: FREE_MAX, used: FREE_MAX },
		});
		const bobs = await createProject(BOB);
		expect((await post(BOB, bobs, "mine")).status).toBe(201);
	});

	it("applies the Pro limit", async () => {
		await UserModel.updateOne({ sub: ALICE }, { plan: "pro" });
		const project = await createProject(ALICE);
		for (let i = 0; i <= FREE_MAX; i += 1) {
			expect((await post(ALICE, project, `r${i}`)).status).toBe(201);
		}
		expect(limitsFor("pro").resources).toBeGreaterThan(FREE_MAX);
	});

	it("never exceeds the limit under concurrent creates in several projects", async () => {
		const projects = [
			await createProject(ALICE, "A"),
			await createProject(ALICE, "B"),
			await createProject(ALICE, "C"),
		];
		const results = await Promise.all(
			Array.from({ length: FREE_MAX + 5 }, (_, i) =>
				post(ALICE, projects[i % projects.length] ?? "", `r${i}`),
			),
		);
		const statuses = results.map((res) => res.status);
		expect(statuses.filter((s) => s === 201)).toHaveLength(FREE_MAX);
		expect(statuses.filter((s) => s === 403)).toHaveLength(5);
		expect(await ResourceModel.countDocuments({ ownerSub: ALICE })).toBe(
			FREE_MAX,
		);
	});

	it("frees a slot when a resource or its project is deleted", async () => {
		const project = await createProject(ALICE);
		const ids: string[] = [];
		for (let i = 0; i < FREE_MAX; i += 1) {
			ids.push((await createResource(ALICE, project, { name: `r${i}` })).id);
		}
		await as(ALICE).send("delete", resourcesPath(project, `/${ids[0]}`));
		expect((await post(ALICE, project, "again")).status).toBe(201);
		await as(ALICE).send("delete", `/projects/${project}`);
		expect(await ResourceModel.countDocuments()).toBe(0);
		const next = await createProject(ALICE);
		expect((await post(ALICE, next, "fresh")).status).toBe(201);
	});
});

describe("cloning a project with resources", () => {
	it("copies the tree, schemas and records under new ids", async () => {
		const project = await createProject(ALICE);
		const users = await createResource(ALICE, project, { name: "users" });
		const posts = await createResource(ALICE, project, {
			name: "posts",
			parentId: users.id,
		});
		await as(ALICE).send("put", resourcesPath(project, `/${users.id}`), {
			name: "users",
			schema: [{ name: "posts", type: "Child Resource", childId: posts.id }],
			template: { nick: "$internet.username" },
		});
		await generate(ALICE, project, users.id, 5);
		await generate(ALICE, project, posts.id, 12);

		const clone = await as(BOB).send("post", `/projects/${project}/clone`);
		expect(clone.status).toBe(404);
		const res = await as(ALICE).send("post", `/projects/${project}/clone`);
		expect(res.status).toBe(201);
		const tree = (await as(ALICE).get(resourcesPath(res.body.id))).body.items;
		expect(tree.map((r: { name: string }) => r.name)).toEqual([
			"users",
			"posts",
		]);
		const [copyUsers, copyPosts] = tree;
		expect(copyUsers.id).not.toBe(users.id);
		expect(copyPosts.parentId).toBe(copyUsers.id);
		expect(copyUsers.schema[0].childId).toBe(copyPosts.id);
		expect(copyUsers.template).toEqual({ nick: "$internet.username" });
		expect(await readData(ALICE, res.body.id, copyPosts.id)).toEqual(
			await readData(ALICE, project, posts.id),
		);
		expect(await ResourceModel.countDocuments({ ownerSub: ALICE })).toBe(4);
	});

	it("bills the copy to the cloner and rolls the clone back when over quota", async () => {
		const half = Math.floor(FREE_MAX / 2);
		const project = await createProject(ALICE);
		for (let i = 0; i < half + 1; i += 1) {
			await createResource(ALICE, project, { name: `r${i}` });
		}
		const over = await as(ALICE).send("post", `/projects/${project}/clone`);
		expect(over.status).toBe(403);
		expect(over.body.error.details).toEqual({
			limit: "resources",
			max: FREE_MAX,
			used: half + 1,
		});
		expect(await ProjectModel.countDocuments({ owner: ALICE })).toBe(1);
		expect(await ResourceModel.countDocuments({ ownerSub: ALICE })).toBe(
			half + 1,
		);

		await as(ALICE).send(
			"delete",
			resourcesPath(
				project,
				`/${(await as(ALICE).get(resourcesPath(project))).body.items[0].id}`,
			),
		);
		const fits = await as(ALICE).send("post", `/projects/${project}/clone`);
		expect(fits.status).toBe(201);
		expect(await ResourceModel.countDocuments({ ownerSub: ALICE })).toBe(
			2 * half,
		);
	});
});
