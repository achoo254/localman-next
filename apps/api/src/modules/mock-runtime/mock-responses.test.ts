import { MAX_RESOURCE_BYTES } from "@localman/shared";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import { MAX_RESPONSE_BYTES, renderResponse } from "./render-response.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

describe("custom responses", () => {
	it("renders $count after filtering and before paging, with Faker values", async () => {
		const project = await createMockProject();
		const template = {
			anyKey: "anyValue",
			count: "$count",
			tasks: "$mockData",
			requestId: "$datatype.uuid",
			price: "Giá $5",
		};
		const tasks = await createResource(OWNER, project.id, {
			name: "tasks",
			schema: [{ name: "title", type: "String" }],
			endpoints: [
				{ method: "GET", path: "/:res", response: template },
				{
					method: "GET",
					path: "/:res/:id",
					response: { one: "$mockData", total: "$count" },
				},
			],
		});
		await generate(OWNER, project.id, tasks.id, 30);
		const mock = kit.client(project.secret);
		const res = await mock.get("/tasks?title=title 1&page=2&limit=5");
		expect(res.status).toBe(200);
		// "title 1", "title 10" … "title 19": 11 matches, page 2 holds 5.
		expect(res.body.count).toBe(11);
		expect(res.body.tasks).toHaveLength(5);
		expect(res.body.anyKey).toBe("anyValue");
		expect(res.body.price).toBe("Giá $5");
		expect(res.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
		const again = await mock.get("/tasks?limit=1");
		expect(again.body.requestId).not.toBe(res.body.requestId);
		const one = await mock.get("/tasks/3");
		expect(one.body).toEqual({ one: { id: "3", title: "title 3" }, total: 30 });
	});

	it("caps a response at MAX_RESOURCE_BYTES (2 MB) with 422", () => {
		expect(MAX_RESPONSE_BYTES).toBe(MAX_RESOURCE_BYTES);
		const big = "x".repeat(1024 * 1024);
		const one = renderResponse("$mockData", [{ big }], null);
		expect(one.bytes).toBeGreaterThan(1024 * 1024);
		expect(one.bytes).toBeLessThan(MAX_RESPONSE_BYTES);
		const data = Array.from({ length: 3 }, () => ({ big }));
		expect(() => renderResponse("$mockData", data, null)).toThrowError(
			expect.objectContaining({ status: 422, code: "RESPONSE_TOO_LARGE" }),
		);
		// A parent embedded in every child counts at each place it appears.
		const shared = { big };
		const three = Array.from({ length: 3 }, () => ({ parent: shared }));
		expect(() => renderResponse("$mockData", three, null)).toThrow();
		const repeated = Array.from({ length: 9 }, () => "$mockData");
		expect(() =>
			renderResponse(
				repeated,
				[{ big: "y".repeat(MAX_RESPONSE_BYTES / 8) }],
				1,
			),
		).toThrowError(expect.objectContaining({ code: "RESPONSE_TOO_LARGE" }));
	});
});

describe("relation fields", () => {
	it("embeds the parent record and lists child records when answering", async () => {
		const project = await createMockProject();
		const users = await createResource(OWNER, project.id, {
			name: "users",
			schema: [{ name: "name", type: "String" }],
		});
		const posts = await createResource(OWNER, project.id, {
			name: "posts",
			parentId: users.id,
			schema: [
				{ name: "title", type: "String" },
				{ name: "author", type: "Parent Resource" },
			],
		});
		const updated = await as(OWNER).send(
			"put",
			`/projects/${project.id}/resources/${users.id}`,
			{
				name: "users",
				schema: [
					{ name: "name", type: "String" },
					{ name: "posts", type: "Child Resource", childId: posts.id },
				],
			},
		);
		expect(updated.status, JSON.stringify(updated.body)).toBe(200);
		await generate(OWNER, project.id, users.id, 2);
		await generate(OWNER, project.id, posts.id, 5);
		const mock = kit.client(project.secret);
		const post = (await mock.get("/posts/1")).body;
		expect(post.author).toEqual({
			id: post.userId,
			name: `name ${post.userId}`,
		});
		const user = (await mock.get(`/users/${post.userId}`)).body;
		expect(user.posts.map((p: { id: string }) => p.id)).toContain("1");
		for (const child of user.posts) {
			expect(child.userId).toBe(user.id);
			expect(child.author).toBeUndefined();
		}
		const created = await mock.call("post", "/users/1/posts", {
			title: "mine",
			author: "ignored",
		});
		expect(created.body.author).toMatchObject({ id: "1" });
	});
});
