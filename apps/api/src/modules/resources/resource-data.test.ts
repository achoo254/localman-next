import { MAX_GENERATE_COUNT } from "@localman/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { RecordModel } from "./record-model.js";
import {
	createProject,
	createResource,
	generate,
	readData,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_data_alice";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});

async function usersAndPosts() {
	const project = await createProject(ALICE);
	const users = await createResource(ALICE, project, { name: "users" });
	const posts = await createResource(ALICE, project, {
		name: "posts",
		parentId: users.id,
		schema: [
			{ name: "title", type: "String" },
			{ name: "rank", type: "Number" },
			{ name: "meta", type: "Object" },
			{ name: "author", type: "Parent Resource" },
		],
	});
	return { project, users, posts };
}

describe("generating data", () => {
	it("generates exactly 0, 50 and 100 records with ids 1..n", async () => {
		const { project, users } = await usersAndPosts();
		for (const count of [50, 100, 0]) {
			const res = await generate(ALICE, project, users.id, count);
			expect(res.status).toBe(200);
			const records = await readData(ALICE, project, users.id);
			expect(records).toHaveLength(count);
			expect(records.map((r) => r.id)).toEqual(
				Array.from({ length: count }, (_, i) => String(i + 1)),
			);
		}
		const [first] = (await generate(ALICE, project, users.id, 1)).body.changes;
		expect(first).toMatchObject({ countBefore: 0, countAfter: 1 });
		const [record] = await readData(ALICE, project, users.id);
		expect(Object.keys(record ?? {})).toEqual([
			"id",
			"createdAt",
			"name",
			"avatar",
		]);
		expect(record?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it(`refuses ${MAX_GENERATE_COUNT + 1} records and negative counts with 400`, async () => {
		const { project, users } = await usersAndPosts();
		for (const count of [MAX_GENERATE_COUNT + 1, -1, 1.5]) {
			const res = await generate(ALICE, project, users.id, count);
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
		}
	});

	it("needs parent data first (409), then spreads children over parents", async () => {
		const { project, users, posts } = await usersAndPosts();
		const blocked = await generate(ALICE, project, posts.id, 10);
		expect(blocked.status).toBe(409);
		expect(blocked.body.error).toEqual({
			code: "PARENT_HAS_NO_DATA",
			message: "Generate data for the parent resource first",
		});
		await generate(ALICE, project, users.id, 5);
		expect((await generate(ALICE, project, posts.id, 60)).status).toBe(200);
		const records = await readData(ALICE, project, posts.id);
		expect(records).toHaveLength(60);
		expect(records[2]).toMatchObject({
			id: "3",
			title: "title 3",
			rank: 3,
			meta: {},
		});
		expect(records[0]).not.toHaveProperty("author");
		const parents = new Set(records.map((r) => r.userId));
		for (const parent of parents)
			expect(["1", "2", "3", "4", "5"]).toContain(parent);
		expect(parents.size).toBeGreaterThan(1);
	});

	it("re-links orphaned children when the parent shrinks and resets them when it empties", async () => {
		const { project, users, posts } = await usersAndPosts();
		await generate(ALICE, project, users.id, 50);
		await generate(ALICE, project, posts.id, 100);
		await generate(ALICE, project, users.id, 2);
		const relinked = await readData(ALICE, project, posts.id);
		expect(relinked).toHaveLength(100);
		expect(relinked.every((r) => r.userId === "1" || r.userId === "2")).toBe(
			true,
		);

		const reset = await generate(ALICE, project, users.id, 0);
		expect(reset.body.changes).toEqual([
			expect.objectContaining({ name: "users", countAfter: 0 }),
			expect.objectContaining({
				name: "posts",
				countBefore: 100,
				countAfter: 0,
			}),
		]);
		expect(await readData(ALICE, project, posts.id)).toEqual([]);
	});

	it("renders the object template instead of the schema", async () => {
		const project = await createProject(ALICE);
		const people = await createResource(ALICE, project, {
			name: "people",
			template: {
				profile: { email: "$internet.email", tags: ["$word.noun", "fixed"] },
				price: "$5",
			},
		});
		await generate(ALICE, project, people.id, 3);
		const records = await readData(ALICE, project, people.id);
		expect(records.map((r) => r.id)).toEqual(["1", "2", "3"]);
		const profile = records[0]?.profile as { email: string; tags: unknown[] };
		expect(profile.email).toContain("@");
		expect(profile.tags[1]).toBe("fixed");
		expect(records[0]?.price).toBe("$5");
	});

	it("previews with dryRun without writing", async () => {
		const { project, users } = await usersAndPosts();
		const res = await as(ALICE).send(
			"post",
			resourcesPath(project, `/${users.id}/generate?dryRun=true`),
			{ count: 7 },
		);
		expect(res.body).toMatchObject({
			dryRun: true,
			changes: [{ countAfter: 7 }],
		});
		expect(await RecordModel.countDocuments()).toBe(0);
	});
});

describe("project-wide generate and reset", () => {
	it("generates every resource parents first, then resets all", async () => {
		const { project, users, posts } = await usersAndPosts();
		await generate(ALICE, project, users.id, 4);
		const all = await as(ALICE).send(
			"post",
			resourcesPath(project, "/generate_all"),
			{},
		);
		expect(all.status).toBe(200);
		expect(
			all.body.changes.map((c: { countAfter: number }) => c.countAfter),
		).toEqual([4, 10]);
		const fixed = await as(ALICE).send(
			"post",
			resourcesPath(project, "/generate_all"),
			{ count: 25 },
		);
		expect(fixed.status).toBe(200);
		expect(await readData(ALICE, project, posts.id)).toHaveLength(25);

		const reset = await as(ALICE).send(
			"post",
			resourcesPath(project, "/reset_all"),
			{},
		);
		expect(reset.body.changes).toHaveLength(2);
		expect(await RecordModel.countDocuments()).toBe(0);
		await generate(ALICE, project, users.id, 1);
		expect((await readData(ALICE, project, users.id))[0]?.id).toBe("1");
	});
});
