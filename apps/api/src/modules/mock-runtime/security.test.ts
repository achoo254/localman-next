import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { RecordModel } from "../resources/record-model.js";
import {
	createResource,
	generate,
	resourcesPath,
} from "../resources/testing/resource-fixture.js";
import { renderResponse } from "./render-response.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

async function usersProject() {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, {
		name: "users",
		schema: [{ name: "title", type: "String" }],
	});
	await generate(OWNER, project.id, users.id, 5);
	return { project, users, mock: kit.client(project.secret) };
}

/** A raw JSON body, so `__proto__` reaches the server as a key. */
function rawJson(
	mock: ReturnType<typeof kit.client>,
	method: "post" | "put" | "patch",
	path: string,
	json: string,
) {
	return mock
		.call(method, path)
		.set("content-type", "application/json")
		.send(json);
}

describe("NoSQL injection", () => {
	it("refuses operator, dotted and prototype query names before any lookup", async () => {
		const { mock } = await usersProject();
		for (const query of [
			"title[$ne]=x",
			"title[$regex]=.*",
			"$where=1",
			"$where=sleep(1000)",
			"a.b=1",
			"sortBy=__proto__",
			"sortBy=constructor",
			"orderBy=$natural",
			"title=a&title=b",
		]) {
			const res = await mock.get(`/users?${query}`);
			expect(res.status, query).toBe(400);
			expect(res.body.error.code, query).toBe("INVALID_QUERY");
			expect(JSON.stringify(res.body)).not.toContain("stack");
		}
	});

	it("treats search text and ids as plain strings", async () => {
		const { mock } = await usersProject();
		expect((await mock.get("/users?search=.*")).body).toEqual([]);
		expect((await mock.get("/users?title=.*")).body).toEqual([]);
		const encoded = encodeURIComponent('{"$gt":""}');
		expect((await mock.get(`/users/${encoded}`)).status).toBe(404);
		expect(
			(await mock.call("put", `/users/${encoded}`, { title: "x" })).status,
		).toBe(404);
		expect((await mock.get("/users/..%2F..")).status).toBe(404);
	});

	it("stores keys with $ and . as data, never as operators or paths", async () => {
		const { mock, users } = await usersProject();
		const body = { $where: "1", "a.b": 2, $set: { title: "hijack" } };
		const created = await mock.call("post", "/users", body);
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject(body);
		const updated = await mock.call("patch", "/users/1", {
			$inc: { count: 1 },
		});
		expect(updated.status).toBe(200);
		expect(updated.body).toMatchObject({
			title: "title 1",
			$inc: { count: 1 },
		});
		const stored = await RecordModel.findOne({
			resourceId: users.id,
			id: "1",
		}).lean();
		expect(stored?.data).toMatchObject({
			title: "title 1",
			$inc: { count: 1 },
		});
	});
});

describe("prototype pollution", () => {
	it("refuses __proto__, constructor and prototype keys in bodies at any depth", async () => {
		const { mock } = await usersProject();
		const payloads = [
			'{"__proto__":{"polluted":true}}',
			'{"constructor":{"prototype":{"polluted":true}}}',
			'{"nested":{"__proto__":{"polluted":true}}}',
			'{"list":[{"prototype":{"polluted":true}}]}',
		];
		for (const json of payloads) {
			for (const [method, path] of [
				["post", "/users"],
				["put", "/users/1"],
				["patch", "/users/1"],
			] as const) {
				const res = await rawJson(mock, method, path, json);
				expect(res.status, `${method} ${json}`).toBe(400);
				expect(res.body.error.code).toBe("VALIDATION_ERROR");
			}
		}
		const probe: Record<string, unknown> = {};
		expect(probe.polluted).toBeUndefined();
		expect(Object.prototype).not.toHaveProperty("polluted");
		expect((await mock.get("/users/1")).body).toEqual({
			id: "1",
			title: "title 1",
		});
	});

	it("never evaluates template references such as $constructor.constructor", async () => {
		const { project, users } = await usersProject();
		const saved = await as(OWNER).send(
			"put",
			resourcesPath(project.id, `/${users.id}`),
			{
				name: "users",
				endpoints: [
					{
						method: "GET",
						path: "/:res",
						response: { x: "$constructor.constructor" },
					},
				],
			},
		);
		expect(saved.status).toBe(400);
		const { body: rendered } = renderResponse(
			{ x: "$constructor.constructor", y: "$__proto__", z: "$mockData" },
			[],
			0,
		);
		expect(rendered).toEqual({
			x: "$constructor.constructor",
			y: "$__proto__",
			z: [],
		});
	});
});

describe("project isolation", () => {
	it("serves only the records of the addressed project", async () => {
		const a = await usersProject();
		const b = await usersProject();
		await a.mock.call("put", "/users/1", { title: "only in A" });
		expect((await a.mock.get("/users/1")).body.title).toBe("only in A");
		expect((await b.mock.get("/users/1")).body.title).toBe("title 1");
		expect((await b.mock.get("/users?title=only")).body).toEqual([]);
		const wrong = await kit.client(`${a.project.secret}x`).get("/users");
		expect(wrong.status).toBe(404);
		expect(wrong.body).toBe("Not found");
	});
});
