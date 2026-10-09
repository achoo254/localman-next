import { describe, expect, it } from "vitest";
import { RecordModel } from "../resources/record-model.js";
import { ResourceModel } from "../resources/resource-model.js";
import {
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

async function usersPostsComments() {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	const posts = await createResource(OWNER, project.id, {
		name: "posts",
		parentId: users.id,
		schema: [
			{ name: "title", type: "String" },
			{ name: "views", type: "Number" },
		],
	});
	const comments = await createResource(OWNER, project.id, {
		name: "comments",
		parentId: posts.id,
		schema: [{ name: "body", type: "String" }],
	});
	for (const [resource, count] of [
		[users, 3],
		[posts, 6],
		[comments, 12],
	] as const) {
		expect((await generate(OWNER, project.id, resource.id, count)).status).toBe(
			200,
		);
	}
	return { project, users, posts, comments, mock: kit.client(project.secret) };
}

describe("mock CRUD", () => {
	it('lists, reads one and answers "Not found" like the source', async () => {
		const { mock } = await usersPostsComments();
		const list = await mock.get("/users");
		expect(list.status).toBe(200);
		expect(list.headers["content-type"]).toMatch(/^application\/json/);
		expect(list.body.map((user: { id: string }) => user.id)).toEqual([
			"1",
			"2",
			"3",
		]);
		const one = await mock.get("/users/2");
		expect(one.status).toBe(200);
		expect(Object.keys(one.body)).toEqual([
			"id",
			"createdAt",
			"name",
			"avatar",
		]);
		for (const path of ["/users/99", "/nope", "/users/1/nope", "/"]) {
			const missing = await mock.get(path);
			expect(missing.status, path).toBe(404);
			expect(missing.body, path).toBe("Not found");
		}
	});

	it("serves nested routes of any depth and keeps the flat route", async () => {
		const { mock } = await usersPostsComments();
		const all = (await mock.get("/comments")).body as { postId: string }[];
		expect(all).toHaveLength(12);
		const postsOfUser1 = (await mock.get("/users/1/posts")).body as {
			userId: string;
			id: string;
		}[];
		expect(postsOfUser1.every((post) => post.userId === "1")).toBe(true);
		const post = postsOfUser1[0];
		if (post) {
			const deep = await mock.get(`/users/1/posts/${post.id}/comments`);
			expect(deep.status).toBe(200);
			for (const comment of deep.body) expect(comment.postId).toBe(post.id);
			// The same post under another user is not on that route.
			const wrongParent = await mock.get(`/users/2/posts/${post.id}`);
			expect(wrongParent.status).toBe(404);
		}
		expect((await mock.get("/users/99/posts")).status).toBe(404);
	});

	it("creates with id = nextId, filling missing schema fields", async () => {
		const { mock, posts } = await usersPostsComments();
		const created = await mock.call("post", "/users/2/posts", {
			id: "999",
			userId: "3",
			title: "Hello",
			extra: { nested: true },
		});
		expect(created.status).toBe(201);
		expect(created.body).toEqual({
			id: "7",
			userId: "2",
			title: "Hello",
			views: 7,
			extra: { nested: true },
		});
		const stored = await ResourceModel.findById(posts.id).lean();
		expect(stored).toMatchObject({ count: 7, nextId: 8 });
		const again = await mock.call("post", "/posts", { userId: 1 });
		expect(again.status).toBe(201);
		expect(again.body).toMatchObject({
			id: "8",
			userId: "1",
			title: "title 8",
		});
	});

	it("refuses a child without an existing parent", async () => {
		const { mock } = await usersPostsComments();
		for (const body of [{}, { userId: "42" }, { userId: { $gt: "" } }]) {
			const res = await mock.call("post", "/posts", body);
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
		}
		expect((await mock.call("post", "/users/42/posts", {})).status).toBe(404);
	});

	it("merges PUT and PATCH bodies without changing id or parent", async () => {
		const { mock } = await usersPostsComments();
		const before = (await mock.get("/posts/1")).body;
		for (const method of ["put", "patch"] as const) {
			const res = await mock.call(method, "/posts/1", {
				id: "50",
				userId: "99",
				title: `via ${method}`,
				tags: ["a"],
			});
			expect(res.status).toBe(200);
			expect(res.body).toEqual({
				...before,
				title: `via ${method}`,
				tags: ["a"],
			});
		}
		expect((await mock.call("put", "/posts/77", { title: "x" })).status).toBe(
			404,
		);
	});

	it("deletes a record with its descendants and answers the record", async () => {
		const { mock, users, posts, comments } = await usersPostsComments();
		const user = (await mock.get("/users/1")).body;
		const postIds = (
			(await mock.get("/users/1/posts")).body as { id: string }[]
		).map((post) => post.id);
		const removed = await mock.call("delete", "/users/1");
		expect(removed.status).toBe(200);
		expect(removed.body).toEqual(user);
		expect((await mock.get("/users/1")).status).toBe(404);
		const left = await RecordModel.countDocuments({ resourceId: posts.id });
		expect(left).toBe(6 - postIds.length);
		const orphans = await RecordModel.countDocuments({
			resourceId: comments.id,
			parentRecordId: { $in: postIds },
		});
		expect(orphans).toBe(0);
		const counts = await ResourceModel.find({
			_id: { $in: [users.id, posts.id, comments.id] },
		}).lean();
		for (const resource of counts) {
			const actual = await RecordModel.countDocuments({
				resourceId: resource._id,
			});
			expect(resource.count).toBe(actual);
		}
		expect((await mock.call("delete", "/users/1")).status).toBe(404);
	});
});
