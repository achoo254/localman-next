import { MAX_SCHEMA_FIELDS } from "@localman/shared";
import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { recordBytes } from "../resources/data-size.js";
import { RecordModel } from "../resources/record-model.js";
import { ResourceModel } from "../resources/resource-model.js";
import {
	createResource,
	resourcesPath,
} from "../resources/testing/resource-fixture.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

/** A post of about 4 KB, so a few hundred fill most of a resource. */
const TITLE = "x".repeat(4000);

/** Stores `count` records of `resourceId` under `parentRecordId`. */
async function seed(
	projectId: string,
	resourceId: string,
	parentRecordId: string | null,
	ids: readonly string[],
	data: Record<string, string>,
): Promise<void> {
	const records = ids.map((id) => ({ id, data }));
	await RecordModel.insertMany(
		records.map((record) => ({
			...record,
			projectId: new Types.ObjectId(projectId),
			resourceId: new Types.ObjectId(resourceId),
			parentRecordId,
		})),
	);
	const bytes = records.reduce((sum, record) => sum + recordBytes(record), 0);
	await ResourceModel.updateOne(
		{ _id: resourceId },
		{ $inc: { count: records.length, dataBytes: bytes } },
	);
}

const range = (from: number, to: number) =>
	Array.from({ length: to - from }, (_, index) => String(from + index));

/** `users` (records 1 and 2) with the given direct children. */
async function family(children: readonly string[]) {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	await seed(project.id, users.id, null, ["1", "2"], { name: "u" });
	const ids: string[] = [];
	for (const name of children) {
		const child = await createResource(OWNER, project.id, {
			name,
			parentId: users.id,
			schema: [{ name: "title", type: "String" }],
		});
		ids.push(child.id);
	}
	return { project, users, childIds: ids };
}

/** Stored as an older release allowed: validation is bypassed. */
async function setRelations(
	resourceId: string,
	fields: readonly { name: string; childId: string }[],
): Promise<void> {
	await ResourceModel.updateOne(
		{ _id: resourceId },
		{
			$set: {
				schema: fields.map(({ name, childId }) => ({
					name,
					type: "Child Resource",
					childId,
				})),
			},
		},
	);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("relation fields within the byte budget", () => {
	it("refuses to save two fields listing the same child", async () => {
		const { project, users, childIds } = await family(["posts"]);
		const [postsId = ""] = childIds;
		const res = await as(OWNER).send(
			"put",
			resourcesPath(project.id, `/${users.id}`),
			{
				name: "users",
				schema: range(0, MAX_SCHEMA_FIELDS).map((index) => ({
					name: `posts${index}`,
					type: "Child Resource",
					childId: postsId,
				})),
			},
		);
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
		expect(res.body.error.details[0]).toMatchObject({
			path: "schema.1.childId",
		});
	});

	it("queries a repeated source once and refuses before loading it all", async () => {
		const { project, users, childIds } = await family(["posts"]);
		const [postsId = ""] = childIds;
		await seed(project.id, postsId, "1", range(1, 400), { title: TITLE });
		await setRelations(
			users.id,
			range(0, MAX_SCHEMA_FIELDS).map((index) => ({
				name: `posts${index}`,
				childId: postsId,
			})),
		);
		const find = vi.spyOn(RecordModel, "find");
		const res = await kit.client(project.secret).get("/users/1");
		expect(res.status).toBe(422);
		expect(res.body.error.code).toBe("RESPONSE_TOO_LARGE");
		const postQueries = find.mock.calls.filter(([filter]) =>
			JSON.stringify(filter ?? null).includes(postsId),
		);
		expect(postQueries).toHaveLength(1);
	});

	it("serves a record whose children fit even when the sources are large", async () => {
		const { project, users, childIds } = await family(["posts", "comments"]);
		const [postsId = "", commentsId = ""] = childIds;
		// About 1.2 MB each: together past the cap, but user 1 owns one of each.
		await seed(project.id, postsId, "1", ["1"], { title: "mine" });
		await seed(project.id, postsId, "2", range(2, 300), { title: TITLE });
		await seed(project.id, commentsId, "1", ["1"], { title: "mine" });
		await seed(project.id, commentsId, "2", range(2, 300), { title: TITLE });
		await setRelations(users.id, [
			{ name: "posts", childId: postsId },
			{ name: "comments", childId: commentsId },
		]);
		const mock = kit.client(project.secret);
		const one = await mock.get("/users/1");
		expect(one.status, JSON.stringify(one.body).slice(0, 200)).toBe(200);
		expect(one.body.posts).toEqual([{ id: "1", userId: "1", title: "mine" }]);
		expect(one.body.comments).toHaveLength(1);
		const all = await mock.get("/users");
		expect(all.status).toBe(422);
		expect(all.body.error.code).toBe("RESPONSE_TOO_LARGE");
	});

	it("treats a resource never measured as full", async () => {
		const { project, users, childIds } = await family(["posts"]);
		const [postsId = ""] = childIds;
		await seed(project.id, postsId, "1", ["1", "2"], { title: "t" });
		await ResourceModel.updateOne(
			{ _id: postsId },
			{ $unset: { dataBytes: 1 } },
		);
		await setRelations(users.id, [{ name: "posts", childId: postsId }]);
		const res = await kit.client(project.secret).get("/users/1");
		expect(res.status).toBe(200);
		expect(res.body.posts).toHaveLength(2);
	});
});
