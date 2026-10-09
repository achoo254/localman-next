/**
 * Contract of the source's wiki (github.com/mockapi-io/docs/wiki): every
 * request of Quick start and Code examples, replayed with the header the
 * wiki sends (`content-type: application/json`, GET included), checked
 * for status and shape. Custom responses live in
 * contract-custom-responses.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
	ALL_TASKS,
	USER_1_TASKS,
	contractProject,
} from "./testing/contract-fixture.js";
import { useMockTestKit } from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

interface Task {
	id: string;
	userId: string;
	title: string;
	completed: boolean;
}

const TASK_SHAPE = {
	id: expect.any(String),
	userId: expect.any(String),
	title: expect.any(String),
	completed: expect.any(Boolean),
};

async function wikiClient() {
	const { secret } = await contractProject();
	const mock = kit.client(secret);
	const send = (
		method: "get" | "post" | "put" | "patch" | "delete",
		path: string,
		body?: object,
	) => mock.call(method, path, body).set("content-type", "application/json");
	return { send };
}

describe("wiki: Quick start", () => {
	it("serves the endpoint table of a resource", async () => {
		const { send } = await wikiClient();
		const list = await send("get", "/tasks");
		expect(list.status).toBe(200);
		expect(list.body).toHaveLength(ALL_TASKS);
		for (const task of list.body) expect(task).toEqual(TASK_SHAPE);
		const one = await send("get", "/tasks/1");
		expect(one.status).toBe(200);
		expect(one.body).toEqual({ ...TASK_SHAPE, id: "1" });
		const created = await send("post", "/tasks", {
			userId: "1",
			content: "Check out mockapi.io",
			completed: false,
		});
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({
			id: String(ALL_TASKS + 1),
			content: "Check out mockapi.io",
			completed: false,
			title: expect.any(String),
		});
		for (const method of ["put", "patch"] as const) {
			const updated = await send(method, "/tasks/1", { completed: true });
			expect(updated.status).toBe(200);
			expect(updated.body).toEqual({ ...one.body, completed: true });
		}
		const removed = await send("delete", "/tasks/1");
		expect(removed.status).toBe(200);
		expect(removed.body).toEqual({ ...one.body, completed: true });
	});

	it("filters incomplete tasks and pages them", async () => {
		const { send } = await wikiClient();
		const open = (await send("get", "/tasks?completed=false")).body as Task[];
		expect(open).toHaveLength(ALL_TASKS / 2);
		expect(open.every((task) => task.completed === false)).toBe(true);
		const firstTen = (
			await send("get", "/tasks?completed=false&page=1&limit=10")
		).body as Task[];
		expect(firstTen.map((task) => task.id)).toEqual(
			open.slice(0, 10).map((t) => t.id),
		);
	});

	it("generates the nested endpoints of a relation", async () => {
		const { send } = await wikiClient();
		expect((await send("get", "/users")).body).toHaveLength(3);
		expect((await send("get", "/users/1")).body).toEqual({
			id: "1",
			name: "Ada",
		});
		expect((await send("post", "/users", { name: "Ken" })).status).toBe(201);
		expect((await send("put", "/users/3", { name: "Hopper" })).body.name).toBe(
			"Hopper",
		);
		expect((await send("patch", "/users/3", { age: 85 })).body).toMatchObject({
			name: "Hopper",
			age: 85,
		});
		const tasksOfUser = (await send("get", "/users/1/tasks")).body as Task[];
		expect(tasksOfUser).toHaveLength(USER_1_TASKS);
		expect((await send("get", "/users/1/tasks/2")).body).toEqual({
			...TASK_SHAPE,
			id: "2",
			userId: "1",
		});
		const created = await send("post", "/users/1/tasks", { title: "nested" });
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({ userId: "1", title: "nested" });
		expect(
			(await send("put", "/users/1/tasks/2", { completed: false })).status,
		).toBe(200);
		expect(
			(await send("patch", "/users/1/tasks/2", { completed: true })).status,
		).toBe(200);
		expect((await send("delete", "/users/1/tasks/2")).body.id).toBe("2");
		expect((await send("delete", "/users/3")).body).toMatchObject({ id: "3" });
	});
});

describe("wiki: Code examples", () => {
	it("runs the CRUD examples on /users/1/tasks", async () => {
		const { send } = await wikiClient();
		const list = await send("get", "/users/1/tasks");
		expect(list.status).toBe(200);
		expect(Array.isArray(list.body)).toBe(true);
		const created = await send("post", "/users/1/tasks", {
			content: "Check out mockapi.io",
			completed: false,
		});
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({ userId: "1", completed: false });
		for (const method of ["put", "patch"] as const) {
			const updated = await send(method, "/users/1/tasks/1", {
				completed: true,
			});
			expect(updated.status).toBe(200);
			expect(updated.body).toMatchObject({ id: "1", completed: true });
		}
		const removed = await send("delete", "/users/1/tasks/1");
		expect(removed.status).toBe(200);
		expect(removed.body).toMatchObject({ id: "1", userId: "1" });
		// Nested and flat task paths are interchangeable.
		expect((await send("get", "/tasks/1")).status).toBe(404);
	});

	it("filters with search, filter and <field>", async () => {
		const { send } = await wikiClient();
		const hello = (path: string) =>
			send("get", path).then((res) =>
				(res.body as Task[]).map((task) => task.id),
			);
		const expected = Array.from({ length: USER_1_TASKS / 3 }, (_, i) =>
			String((i + 1) * 3),
		);
		expect(await hello("/users/1/tasks?search=hello")).toEqual(expected);
		expect(await hello("/users/1/tasks?filter=hello")).toEqual(expected);
		expect(await hello("/users/1/tasks?title=hello")).toEqual(expected);
		const open = (await send("get", "/users/1/tasks?completed=false"))
			.body as Task[];
		expect(open).toHaveLength(USER_1_TASKS / 2);
		expect(open.every((task) => !task.completed && task.userId === "1")).toBe(
			true,
		);
	});

	it("pages with page/p and limit/l", async () => {
		const { send } = await wikiClient();
		const page = (
			await send("get", "/users/1/tasks?completed=false&page=1&limit=10")
		).body as Task[];
		expect(page).toHaveLength(10);
		expect(page.every((task) => !task.completed)).toBe(true);
		const aliases = (
			await send("get", "/users/1/tasks?completed=false&p=2&l=10")
		).body as Task[];
		expect(aliases).toHaveLength(USER_1_TASKS / 2 - 10);
	});

	it("sorts with sortBy and its aliases, asc by default", async () => {
		const { send } = await wikiClient();
		const titles = (path: string) =>
			send("get", path).then((res) =>
				(res.body as Task[]).map((task) => task.title),
			);
		const desc = await titles("/users/1/tasks?sortBy=title&order=desc");
		expect(desc).toEqual([...desc].sort().reverse());
		for (const alias of ["sortby", "orderBy", "orderby"]) {
			expect(await titles(`/users/1/tasks?${alias}=title&order=desc`)).toEqual(
				desc,
			);
		}
		expect(await titles("/users/1/tasks?sortBy=title")).toEqual(
			[...desc].reverse(),
		);
	});
});
