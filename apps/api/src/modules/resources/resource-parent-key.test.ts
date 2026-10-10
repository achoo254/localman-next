import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { ResourceModel } from "./resource-model.js";
import {
	createProject,
	createResource,
	generate,
	readData,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_parent_key_alice";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});

/** Makes the resource look stored before Parent IDs were stored. */
async function forgetParentKey(resourceId: string): Promise<void> {
	await ResourceModel.updateOne(
		{ _id: new Types.ObjectId(resourceId) },
		{ $unset: { parentKey: 1 } },
	);
}

const update = (project: string, id: string, body: object) =>
	as(ALICE).send("put", resourcesPath(project, `/${id}`), body);

async function peopleWithQuizzes() {
	const project = await createProject(ALICE);
	const people = await createResource(ALICE, project, { name: "people" });
	const quizzes = await createResource(ALICE, project, {
		name: "quizzes",
		parentId: people.id,
	});
	return { project, people, quizzes };
}

describe("Parent ID of a resource", () => {
	it("gives a new nested resource the key of the fixed rule", async () => {
		const { project, people, quizzes } = await peopleWithQuizzes();
		expect(people.parentKey).toBeNull();
		expect(quizzes.parentKey).toBe("personId");
		await generate(ALICE, project, people.id, 2);
		await generate(ALICE, project, quizzes.id, 3);
		const [record] = await readData(ALICE, project, quizzes.id);
		expect(Object.keys(record ?? {}).slice(0, 2)).toEqual(["id", "personId"]);
	});

	it("keeps the old key of a resource stored before keys were", async () => {
		const { project, people, quizzes } = await peopleWithQuizzes();
		await forgetParentKey(quizzes.id);
		const res = await as(ALICE).get(resourcesPath(project));
		const item = res.body.items.find(
			(r: { id: string }) => r.id === quizzes.id,
		);
		expect(item.parentKey).toBe("peopleId");
		// Sending the old key back unchanged is accepted and stays legacy.
		const same = await update(project, quizzes.id, {
			name: "quizzes",
			parentKey: "peopleId",
		});
		expect(same.status, JSON.stringify(same.body)).toBe(200);
		expect(same.body.parentKey).toBe("peopleId");
		// A renamed parent still renames the old key with the old rule.
		await update(project, people.id, { name: "members" });
		const after = await as(ALICE).get(resourcesPath(project, `/${quizzes.id}`));
		expect(after.body.parentKey).toBe("memberId");
	});

	it("uses the fixed rule once an old resource is nested elsewhere", async () => {
		const { project, quizzes } = await peopleWithQuizzes();
		await forgetParentKey(quizzes.id);
		const children = await createResource(ALICE, project, {
			name: "children",
		});
		const moved = await as(ALICE).send(
			"put",
			resourcesPath(project, `/${quizzes.id}/parent`),
			{ parentId: children.id },
		);
		expect(moved.status).toBe(200);
		expect(moved.body.resource.parentKey).toBe("childId");
		const root = await as(ALICE).send(
			"put",
			resourcesPath(project, `/${quizzes.id}/parent`),
			{ parentId: null },
		);
		expect(root.body.resource.parentKey).toBeNull();
	});

	it("stores a key the user chooses on create and update", async () => {
		const { project, people, quizzes } = await peopleWithQuizzes();
		const posts = await createResource(ALICE, project, {
			name: "posts",
			parentId: people.id,
			parentKey: "authorId",
		});
		expect(posts.parentKey).toBe("authorId");
		await generate(ALICE, project, people.id, 2);
		await generate(ALICE, project, quizzes.id, 2);
		const res = await update(project, quizzes.id, {
			name: "quizzes",
			parentKey: "$owner_1",
		});
		expect(res.status).toBe(200);
		expect(res.body.parentKey).toBe("$owner_1");
		const [record] = await readData(ALICE, project, quizzes.id);
		expect(record).toHaveProperty("$owner_1");
		expect(record).not.toHaveProperty("personId");
	});

	it("refuses invalid keys with 400 at parentKey", async () => {
		const { project, people, quizzes } = await peopleWithQuizzes();
		for (const parentKey of ["1abc", "user-id", "id", "__proto__", "name"]) {
			const res = await update(project, quizzes.id, {
				name: "quizzes",
				parentKey,
			});
			expect(res.status, parentKey).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
			expect(res.body.error.details[0].path).toBe("parentKey");
		}
		const root = await update(project, people.id, {
			name: "people",
			parentKey: "teamId",
		});
		expect(root.status).toBe(400);
		expect(root.body.error.details[0].path).toBe("parentKey");
		const created = await as(ALICE).send("post", resourcesPath(project), {
			name: "tags",
			parentId: people.id,
			parentKey: "x".repeat(65),
		});
		expect(created.status).toBe(400);
		expect(created.body.error.details[0].path).toBe("parentKey");
	});

	it("refuses a key that records already hold as a field", async () => {
		const { project, people, quizzes } = await peopleWithQuizzes();
		await generate(ALICE, project, people.id, 1);
		const put = await as(ALICE).send(
			"put",
			resourcesPath(project, `/${quizzes.id}/data`),
			{ data: [{ personId: "1", ownerId: "kept" }] },
		);
		expect(put.status, JSON.stringify(put.body)).toBe(200);
		const res = await update(project, quizzes.id, {
			name: "quizzes",
			parentKey: "ownerId",
		});
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("FIELD_CONFLICT");
	});

	it("follows a parent rename only for keys built from its name", async () => {
		const { project, people, quizzes } = await peopleWithQuizzes();
		const posts = await createResource(ALICE, project, {
			name: "posts",
			parentId: people.id,
			parentKey: "authorId",
		});
		const res = await update(project, people.id, { name: "members" });
		expect(res.status).toBe(200);
		const list = await as(ALICE).get(resourcesPath(project));
		const keyOf = (id: string) =>
			list.body.items.find((r: { id: string }) => r.id === id)?.parentKey;
		expect(keyOf(quizzes.id)).toBe("memberId");
		expect(keyOf(posts.id)).toBe("authorId");
	});
});
