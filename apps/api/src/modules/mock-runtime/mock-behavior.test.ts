import { MAX_RULES_PER_ENDPOINT } from "@localman/shared/endpoint-behavior";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	createResource,
	generate,
	resourcesPath,
} from "../resources/testing/resource-fixture.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

const forbidAdmin = {
	match: { source: "header", key: "x-role" },
	op: "eq",
	value: "admin",
	response: {
		status: 403,
		body: { error: "admins are read-only here" },
		headers: [{ name: "X-Reason", value: "role" }],
	},
};

async function usersWith(endpoints: unknown[]) {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, {
		name: "users",
		schema: [{ name: "name", type: "String" }],
		endpoints,
	});
	await generate(OWNER, project.id, users.id, 3);
	return { project, users, mock: kit.client(project.secret) };
}

describe("conditional rules over REST", () => {
	it("answers 403 as configured for x-role: admin and writes nothing", async () => {
		const { mock } = await usersWith([
			{ method: "POST", path: "/:res", rules: [forbidAdmin] },
		]);
		const denied = await mock
			.call("post", "/users", { name: "Eve" })
			.set("x-role", "admin");
		expect(denied.status).toBe(403);
		expect(denied.body).toEqual({ error: "admins are read-only here" });
		expect(denied.headers["x-reason"]).toBe("role");
		expect((await mock.get("/users")).body).toHaveLength(3);
		const created = await mock
			.call("post", "/users", { name: "Eve" })
			.set("x-role", "viewer");
		expect(created.status).toBe(201);
		expect((await mock.get("/users")).body).toHaveLength(4);
	});

	it("renders $mockData and $count of reads and counts nth per endpoint", async () => {
		const { mock } = await usersWith([
			{
				method: "GET",
				path: "/:res",
				rules: [
					{
						match: { source: "nth" },
						op: "eq",
						value: 2,
						response: { status: 503, body: { retry: true } },
					},
					{
						match: { source: "query", key: "wrap" },
						op: "exists",
						response: {
							status: 200,
							body: { items: "$mockData", total: "$count" },
						},
					},
				],
			},
		]);
		const first = await mock.get("/users?wrap=1&limit=1");
		expect(first.body).toEqual({
			items: [{ id: "1", name: "name 1" }],
			total: 3,
		});
		expect((await mock.get("/users?wrap=1")).status).toBe(503);
		// The single-record endpoint has no rules and its own count.
		expect((await mock.get("/users/1")).status).toBe(200);
		expect((await mock.get("/users")).body).toHaveLength(3);
	});
});

describe("chaos over REST", () => {
	it("injects errors, 429 with Retry-After and timeouts", async () => {
		const { mock } = await usersWith([
			{
				method: "GET",
				path: "/:res",
				chaos: { errorRate: 1, errorStatus: 502 },
			},
			{ method: "GET", path: "/:res/:id", chaos: { rateLimitRate: 1 } },
			{
				method: "DELETE",
				path: "/:res/:id",
				chaos: { timeoutRate: 1, latencyMs: [20, 60] },
			},
		]);
		const failed = await mock.get("/users");
		expect(failed.status).toBe(502);
		expect(failed.body.error.code).toBe("MOCK_CHAOS_ERROR");
		const limited = await mock.get("/users/1");
		expect(limited.status).toBe(429);
		expect(limited.headers["retry-after"]).toBe("1");
		expect(limited.body.error.code).toBe("RATE_LIMITED");
		const started = Date.now();
		const timedOut = await mock.call("delete", "/users/1");
		expect(Date.now() - started).toBeGreaterThanOrEqual(55);
		expect(timedOut.status).toBe(504);
		expect(timedOut.body.error.code).toBe("MOCK_TIMEOUT");
		expect((await mock.get("/users/1")).status).toBe(429);
	});

	it("delays a matched rule but never fails it", async () => {
		const { mock } = await usersWith([
			{
				method: "GET",
				path: "/:res",
				chaos: { errorRate: 1, latencyMs: [40, 40] },
				rules: [{ ...forbidAdmin, op: "exists", value: undefined }],
			},
		]);
		const started = Date.now();
		const res = await mock.get("/users").set("x-role", "anyone");
		expect(Date.now() - started).toBeGreaterThanOrEqual(35);
		expect(res.status).toBe(403);
	});
});

describe("validation through the dashboard API", () => {
	it("refuses too many rules, long delays and unsafe input", async () => {
		const project = await createMockProject();
		const endpoint = (extra: Record<string, unknown>) => ({
			name: "items",
			endpoints: [{ method: "GET", path: "/:res", ...extra }],
		});
		const bad = [
			{
				rules: Array.from(
					{ length: MAX_RULES_PER_ENDPOINT + 1 },
					() => forbidAdmin,
				),
			},
			{ chaos: { latencyMs: [0, 30_001] } },
			{ chaos: { errorRate: 2 } },
			{ rules: [{ ...forbidAdmin, op: "regex", value: "(a+)+$" }] },
			{
				rules: [
					{
						...forbidAdmin,
						response: {
							status: 200,
							headers: [{ name: "Set-Cookie", value: "a=1" }],
						},
					},
				],
			},
		];
		for (const extra of bad) {
			const res = await as(OWNER).send(
				"post",
				resourcesPath(project.id),
				endpoint(extra),
			);
			expect(res.status, JSON.stringify(extra).slice(0, 80)).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
		}
	});
});
