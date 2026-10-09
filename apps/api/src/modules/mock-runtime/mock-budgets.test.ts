import { Writable } from "node:stream";
import { pino } from "pino";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockApp } from "../../mock-server.js";
import { ResourceModel } from "../resources/resource-model.js";
import {
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import {
	MOCK_DOMAIN,
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";
import { UsageMeter } from "./usage-meter.js";

const kit = useMockTestKit();
afterEach(() => {
	vi.restoreAllMocks();
});

async function projectWithUsers(count = 20) {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	await generate(OWNER, project.id, users.id, count);
	return project;
}

/** Sequential requests, far more than a limit, so one window overflows. */
async function run(send: () => request.Test, times: number) {
	const responses = [];
	for (let i = 0; i < times; i += 1) responses.push(await send());
	return responses;
}

describe("per-secret budgets", () => {
	it("answers 429 once a second's response bytes are spent", async () => {
		const project = await projectWithUsers();
		const mock = kit.client(project.secret, {
			limits: { responseBytesPerSecret: 1_000 },
		});
		const responses = await run(() => mock.get("/users"), 8);
		expect(responses[0]?.status).toBe(200);
		const limited = responses.find((res) => res.status === 429);
		expect(limited?.body.error.code).toBe("RATE_LIMITED");
		expect(Number(limited?.headers["retry-after"])).toBeGreaterThanOrEqual(1);
		// Another project's budget is untouched.
		const other = await projectWithUsers(1);
		const fresh = await request(mock.app)
			.get("/users")
			.set("host", `${other.secret}.${MOCK_DOMAIN}`);
		expect(fresh.status).toBe(200);
	});

	it("charges the collection a list scans, even when nothing matches", async () => {
		const project = await projectWithUsers();
		const mock = kit.client(project.secret, {
			limits: { responseBytesPerSecret: 1_000 },
		});
		const responses = await run(() => mock.get("/users?search=khong-co-ai"), 8);
		expect(responses[0]?.status).toBe(200);
		expect(responses[0]?.body).toEqual([]);
		expect(responses.map((res) => res.status)).toContain(429);
	});

	it("limits writes separately from reads", async () => {
		const project = await projectWithUsers();
		const mock = kit.client(project.secret, { limits: { writesPerSecret: 2 } });
		const writes = await run(
			() => mock.call("patch", "/users/1", { note: "x" }),
			8,
		);
		expect(writes.map((res) => res.status)).toContain(429);
		expect((await mock.get("/users/1")).status).toBe(200);
	});
});

describe("request id", () => {
	it("is logged with an unexpected error and matches the response header", async () => {
		const project = await projectWithUsers(1);
		const lines: string[] = [];
		const sink = new Writable({
			write(chunk, _encoding, done) {
				lines.push(String(chunk));
				done();
			},
		});
		const logger = pino({ level: "error" }, sink);
		const app = createMockApp({
			logger,
			usageMeter: new UsageMeter({ logger, warn: async () => {} }),
		});
		vi.spyOn(ResourceModel, "find").mockImplementation(() => {
			throw new Error("database exploded");
		});
		const res = await request(app)
			.get(`/m/${project.secret}/users`)
			.set("host", "localhost");
		expect(res.status).toBe(500);
		expect(res.body).toEqual({
			error: { code: "INTERNAL_ERROR", message: "Internal server error" },
		});
		const id = res.headers["x-localman-request-id"];
		const [entry] = lines.map((line) => JSON.parse(line));
		expect(entry).toMatchObject({
			requestId: id,
			secret: `${project.secret.slice(0, 4)}…`,
		});
		expect(lines.join("")).not.toContain(project.secret);
	});
});
