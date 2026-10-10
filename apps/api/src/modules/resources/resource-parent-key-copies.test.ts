import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import {
	as,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { ResourceModel } from "./resource-model.js";
import { dataOf, importAs } from "./testing/import-fixture.js";
import {
	createProject,
	createResource,
	resourcesPath,
} from "./testing/resource-fixture.js";

const ALICE = "acc_parent_key_copies";

useDashboardTestDb();
beforeEach(async () => {
	await UserModel.create({ sub: ALICE, username: "alice" });
});

describe("Parent ID of imported and cloned resources", () => {
	it("gives imported nested resources the key of the fixed rule", async () => {
		const projectId = await createProject(ALICE);
		const input = [{ id: "p1", name: "Ada", quizzes: [{ id: 1, q: "?" }] }];
		const res = await importAs(ALICE, projectId, {
			format: "json",
			input,
			name: "people",
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const [, quizzes] = res.body.created;
		expect(quizzes.parentKey).toBe("personId");
		const stored = await ResourceModel.findById(quizzes.id).lean();
		expect(stored?.parentKey).toBe("personId");
		expect(await dataOf(ALICE, projectId, quizzes.id)).toEqual([
			{ id: "1", personId: "p1", q: "?" },
		]);
	});

	it("copies stored keys and leaves old resources on the old rule", async () => {
		const projectId = await createProject(ALICE);
		const people = await createResource(ALICE, projectId, { name: "people" });
		await createResource(ALICE, projectId, {
			name: "quizzes",
			parentId: people.id,
			parentKey: "ownerId",
		});
		const old = await createResource(ALICE, projectId, {
			name: "tags",
			parentId: people.id,
		});
		await ResourceModel.updateOne(
			{ _id: new Types.ObjectId(old.id) },
			{ $unset: { parentKey: 1 } },
		);
		const clone = await as(ALICE).send("post", `/projects/${projectId}/clone`);
		expect(clone.status).toBe(201);
		const list = await as(ALICE).get(resourcesPath(clone.body.id));
		const keys = Object.fromEntries(
			list.body.items.map((r: { name: string; parentKey: string | null }) => [
				r.name,
				r.parentKey,
			]),
		);
		expect(keys).toEqual({
			people: null,
			quizzes: "ownerId",
			tags: "peopleId",
		});
		const copy = await ResourceModel.findOne({
			projectId: new Types.ObjectId(String(clone.body.id)),
			name: "tags",
		}).lean();
		expect(copy).not.toHaveProperty("parentKey");
	});
});
