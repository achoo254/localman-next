import { MAX_RECORDS_PER_RESOURCE } from "@localman/shared";
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

const ALICE = "acc_replace_alice";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});

const putData = (project: string, id: string, body: object, dry = false) =>
	as(ALICE).send(
		"put",
		resourcesPath(project, `/${id}/data${dry ? "?dryRun=true" : ""}`),
		body,
	);

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

describe("replacing data", () => {
	it("refuses a body that is not an array, or more than the record limit", async () => {
		const { project, users } = await usersAndPosts();
		for (const body of [{ data: { id: 1 } }, { data: "[]" }, {}]) {
			const res = await putData(project, users.id, body);
			expect(res.status).toBe(400);
		}
		const tooMany = Array.from(
			{ length: MAX_RECORDS_PER_RESOURCE + 1 },
			() => ({}),
		);
		expect((await putData(project, users.id, { data: tooMany })).status).toBe(
			400,
		);
		const full = tooMany.slice(1);
		expect((await putData(project, users.id, { data: full })).status).toBe(200);
		expect(await readData(ALICE, project, users.id)).toHaveLength(
			MAX_RECORDS_PER_RESOURCE,
		);
		const raw = await as(ALICE).send(
			"put",
			resourcesPath(project, `/${users.id}/data`),
			[{ id: "1" }] as unknown as object,
		);
		expect(raw.status).toBe(400);
	});

	it("stores the array, numbering missing ids after the highest one", async () => {
		const { project, users } = await usersAndPosts();
		const res = await putData(project, users.id, {
			data: [{ id: 7, name: "A" }, { name: "B" }, { id: "x-1", name: "C" }],
		});
		expect(res.status).toBe(200);
		expect(await readData(ALICE, project, users.id)).toEqual([
			{ id: "7", name: "A" },
			{ id: "8", name: "B" },
			{ id: "x-1", name: "C" },
		]);
	});

	it("validates items, ids and parent links with 400", async () => {
		const { project, users, posts } = await usersAndPosts();
		await generate(ALICE, project, users.id, 2);
		const cases = [
			[1, 2],
			[{ id: "a" }, { id: "a" }],
			[{ id: "a/b" }],
			[{ id: true }],
			[JSON.parse('{"__proto__": {"x": 1}}')],
		];
		for (const data of cases) {
			expect(
				(await putData(project, users.id, { data })).status,
				JSON.stringify(data),
			).toBe(400);
		}
		const badParent = await putData(project, posts.id, {
			data: [{ userId: "9" }],
		});
		expect(badParent.status).toBe(400);
		expect(badParent.body.error.details[0].path).toBe("data.0.userId");
		const ok = await putData(project, posts.id, {
			data: [{ userId: 2, title: "t" }, {}],
		});
		expect(ok.status).toBe(200);
		const records = await readData(ALICE, project, posts.id);
		expect(records[0]).toEqual({ id: "1", userId: "2", title: "t" });
		expect(["1", "2"]).toContain(records[1]?.userId);
	});

	it("validates with dryRun without writing", async () => {
		const { project, users } = await usersAndPosts();
		const res = await putData(project, users.id, { data: [{}, {}] }, true);
		expect(res.body).toMatchObject({
			dryRun: true,
			changes: [{ countAfter: 2 }],
		});
		expect(await RecordModel.countDocuments()).toBe(0);
	});
});
