import { afterEach, describe, expect, it, vi } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { ResourceModel } from "../resources/resource-model.js";
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
afterEach(() => {
	vi.restoreAllMocks();
});

/** Mulberry32: a small seeded PRNG, so the error rate test is repeatable. */
function seeded(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

async function usersWith(endpoints: unknown[]) {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, {
		name: "users",
		schema: [{ name: "name", type: "String" }],
		endpoints,
	});
	await generate(OWNER, project.id, users.id, 2);
	return { project, users, mock: kit.client(project.secret) };
}

describe("rules and chaos with the saved resource", () => {
	it("counts nth again from 1 after every save of the resource", async () => {
		const secondFails = {
			match: { source: "nth" },
			op: "eq",
			value: 2,
			response: { status: 503, body: { retry: true } },
		};
		const { project, users, mock } = await usersWith([
			{ method: "GET", path: "/:res", rules: [secondFails] },
		]);
		const statuses = async (count: number) => {
			const seen: number[] = [];
			for (let i = 0; i < count; i += 1) {
				seen.push((await mock.get("/users")).status);
			}
			return seen;
		};
		expect(await statuses(3)).toEqual([200, 503, 200]);
		const saved = await as(OWNER).send(
			"put",
			resourcesPath(project.id, `/${users.id}`),
			{ name: "users" },
		);
		expect(saved.status, JSON.stringify(saved.body)).toBe(200);
		expect(saved.body.revision).toBe(1);
		expect(saved.body.endpoints[0].rules).toHaveLength(1);
		expect(await statuses(3)).toEqual([200, 503, 200]);
	});

	it("fails 45-55% of 1,000 real REST calls at errorRate 0.5", async () => {
		const { mock } = await usersWith([
			{
				method: "GET",
				path: "/:res/:id",
				chaos: { errorRate: 0.5, errorStatus: 503 },
			},
		]);
		vi.spyOn(Math, "random").mockImplementation(seeded(19));
		let failed = 0;
		for (let i = 0; i < 1_000; i += 1) {
			const res = await mock.get("/users/1");
			if (res.status === 503) {
				expect(res.body.error.code).toBe("MOCK_CHAOS_ERROR");
				failed += 1;
			} else {
				expect(res.status).toBe(200);
			}
		}
		expect(failed).toBeGreaterThanOrEqual(450);
		expect(failed).toBeLessThanOrEqual(550);
	}, 60_000);

	it("leaves out stored rule headers a rule may no longer set", async () => {
		const { users, mock } = await usersWith([
			{
				method: "GET",
				path: "/:res",
				rules: [
					{
						match: { source: "query", key: "q" },
						op: "exists",
						response: { status: 200, headers: [{ name: "x-ok", value: "1" }] },
					},
				],
			},
		]);
		// Saved before the allowlist: written straight to the store.
		await ResourceModel.updateOne(
			{ _id: users.id },
			{
				$set: {
					"endpoints.0.rules.0.response.headers": [
						{ name: "x-ok", value: "1" },
						{ name: "nel", value: '{"report_to":"x"}' },
						{ name: "location", value: "https://example.com" },
						{ name: "content-type", value: "text/html" },
					],
				},
			},
		);
		const res = await mock.get("/users?q=1");
		expect(res.status).toBe(200);
		expect(res.headers["x-ok"]).toBe("1");
		expect(res.headers.nel).toBeUndefined();
		expect(res.headers.location).toBeUndefined();
		expect(res.headers["content-type"]).toMatch(/^application\/json/);
	});
});
