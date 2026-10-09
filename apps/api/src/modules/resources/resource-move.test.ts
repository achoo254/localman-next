import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import {
	createProject,
	createResource,
	generate,
	readData,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_move_alice";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});

async function seedTree() {
	const project = await createProject(ALICE);
	const users = await createResource(ALICE, project, { name: "users" });
	const teams = await createResource(ALICE, project, { name: "teams" });
	const posts = await createResource(ALICE, project, {
		name: "posts",
		parentId: users.id,
		schema: [{ name: "author", type: "Parent Resource" }],
	});
	const comments = await createResource(ALICE, project, {
		name: "comments",
		parentId: posts.id,
	});
	return { project, users, teams, posts, comments };
}

const move = (
	project: string,
	id: string,
	parentId: string | null,
	dry = false,
) =>
	as(ALICE).send(
		"put",
		resourcesPath(project, `/${id}/parent${dry ? "?dryRun=true" : ""}`),
		{ parentId },
	);

describe("moving a resource", () => {
	it("resets the moved subtree and switches the parent id field", async () => {
		const { project, users, teams, posts, comments } = await seedTree();
		await generate(ALICE, project, users.id, 5);
		await generate(ALICE, project, teams.id, 3);
		await generate(ALICE, project, posts.id, 20);
		await generate(ALICE, project, comments.id, 30);

		const preview = await move(project, posts.id, teams.id, true);
		expect(preview.status).toBe(200);
		expect(preview.body.changes).toEqual([
			expect.objectContaining({
				name: "posts",
				countBefore: 20,
				countAfter: 0,
			}),
			expect.objectContaining({
				name: "comments",
				countBefore: 30,
				countAfter: 0,
			}),
		]);
		expect(await readData(ALICE, project, posts.id)).toHaveLength(20);

		const res = await move(project, posts.id, teams.id);
		expect(res.status).toBe(200);
		expect(res.body.resource).toMatchObject({
			parentId: teams.id,
			parentKey: "teamId",
			count: 0,
		});
		expect(await readData(ALICE, project, comments.id)).toEqual([]);
		expect(await readData(ALICE, project, users.id)).toHaveLength(5);

		expect((await generate(ALICE, project, posts.id, 4)).status).toBe(200);
		const records = await readData(ALICE, project, posts.id);
		for (const record of records) {
			expect(["1", "2", "3"]).toContain(record.teamId);
			expect(record).not.toHaveProperty("userId");
		}
	});

	it("drops Parent Resource fields when the resource becomes a root", async () => {
		const { project, posts } = await seedTree();
		const res = await move(project, posts.id, null);
		expect(res.status).toBe(200);
		expect(res.body.resource).toMatchObject({
			parentId: null,
			parentKey: null,
		});
		expect(res.body.resource.schema).toEqual([]);
	});

	it("refuses cycles, itself and sibling name clashes", async () => {
		const { project, users, posts, comments } = await seedTree();
		const cycle = await move(project, users.id, comments.id);
		expect(cycle.status).toBe(409);
		expect(cycle.body.error.code).toBe("TREE_CYCLE");
		expect((await move(project, users.id, users.id)).body.error.code).toBe(
			"TREE_CYCLE",
		);
		await createResource(ALICE, project, { name: "comments" });
		const clash = await move(project, comments.id, null);
		expect(clash.body.error.code).toBe("RESOURCE_NAME_TAKEN");
		expect((await move(project, posts.id, "0".repeat(24))).status).toBe(404);
	});

	it("keeps the parent id field in sync when the parent is renamed", async () => {
		const { project, users, posts } = await seedTree();
		await generate(ALICE, project, users.id, 2);
		await generate(ALICE, project, posts.id, 3);
		const rename = await as(ALICE).send(
			"put",
			resourcesPath(project, `/${users.id}`),
			{ name: "authors" },
		);
		expect(rename.status).toBe(200);
		const records = await readData(ALICE, project, posts.id);
		expect(records).toHaveLength(3);
		expect(Object.keys(records[0] ?? {}).slice(0, 2)).toEqual([
			"id",
			"authorId",
		]);
	});

	it("serializes concurrent moves so they cannot form a cycle", async () => {
		const project = await createProject(ALICE);
		const a = await createResource(ALICE, project, { name: "a" });
		const b = await createResource(ALICE, project, { name: "b" });
		const [first, second] = await Promise.all([
			move(project, a.id, b.id),
			move(project, b.id, a.id),
		]);
		expect([first.status, second.status].sort()).toEqual([200, 409]);
	});
});
