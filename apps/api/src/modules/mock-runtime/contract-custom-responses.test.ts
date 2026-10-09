/**
 * Contract of the wiki page "Custom responses": the default `$mockData`,
 * static values, `$count`, Faker methods per call, and the pagination
 * shape `{ count, tasks }` the page motivates templates with.
 */
import { describe, expect, it } from "vitest";
import { ALL_TASKS, contractProject } from "./testing/contract-fixture.js";
import { useMockTestKit } from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

const WIKI_TEMPLATE = {
	anyKey: "anyValue",
	count: "$count",
	tasks: "$mockData",
	requestId: "$datatype.uuid",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("wiki: Custom responses", () => {
	it("answers $mockData by default: a list or one record", async () => {
		const { secret } = await contractProject();
		const mock = kit.client(secret);
		expect(Array.isArray((await mock.get("/tasks")).body)).toBe(true);
		for (const [method, path, body] of [
			["get", "/tasks/3", undefined],
			["post", "/tasks", { userId: "1" }],
			["put", "/tasks/3", { completed: true }],
			["patch", "/tasks/3", { completed: false }],
			["delete", "/tasks/3", undefined],
		] as const) {
			const res = await mock.call(method, path, body);
			expect(res.body, `${method} ${path}`).toMatchObject({
				id: expect.any(String),
			});
			expect(Array.isArray(res.body)).toBe(false);
		}
	});

	it("renders the wiki template with static values, $count and a new uuid per call", async () => {
		const { secret } = await contractProject([
			{ method: "GET", path: "/:res", response: WIKI_TEMPLATE },
			{ method: "POST", path: "/:res", response: WIKI_TEMPLATE },
		]);
		const mock = kit.client(secret);
		const first = await mock.get("/tasks");
		expect(first.status).toBe(200);
		expect(first.body).toEqual({
			anyKey: "anyValue",
			count: ALL_TASKS,
			tasks: expect.any(Array),
			requestId: expect.stringMatching(UUID),
		});
		expect(first.body.tasks).toHaveLength(ALL_TASKS);
		const second = await mock.get("/tasks");
		expect(second.body.requestId).not.toBe(first.body.requestId);
		const created = await mock.call("post", "/tasks", { userId: "2" });
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({
			count: ALL_TASKS + 1,
			tasks: { id: String(ALL_TASKS + 1) },
		});
	});

	it("gives the pagination shape { count, tasks } with the full count", async () => {
		const { secret } = await contractProject([
			{
				method: "GET",
				path: "/:res",
				response: { count: "$count", tasks: "$mockData" },
			},
		]);
		const mock = kit.client(secret);
		const page = await mock.get("/tasks?page=2&limit=10");
		expect(page.body.count).toBe(ALL_TASKS);
		expect(page.body.tasks).toHaveLength(10);
		expect(page.body.tasks[0]).toEqual({
			id: "11",
			userId: "1",
			title: "task 11",
			completed: false,
		});
	});

	it("turns a disabled endpoint into 404", async () => {
		const { secret } = await contractProject([
			{ method: "GET", path: "/:res/:id", enabled: false },
		]);
		const mock = kit.client(secret);
		expect((await mock.get("/tasks/1")).status).toBe(404);
		expect((await mock.get("/users/1/tasks/1")).status).toBe(404);
		expect((await mock.get("/tasks")).status).toBe(200);
	});
});
