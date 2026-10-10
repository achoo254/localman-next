import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Router } from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createDashboardApp } from "../../dashboard-server.js";
import { createLogger } from "../../logger.js";
import { as } from "../../test-support/dashboard-test-app.js";
import { createSsrfGuard } from "../api-client/ssrf-guard.js";
import { readUsage } from "../billing/usage-counter-model.js";
import { createResource } from "../resources/testing/resource-fixture.js";
import { RequestLogModel, type StoredRequestLog } from "./request-log-model.js";
import { requestLog } from "./request-log-service.js";
import {
	MOCK_DOMAIN,
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";
import { createTrafficOperations } from "./traffic-operations.js";

const kit = useMockTestKit();
const ORIGIN = "https://localman.test";
let mockServer: Server | undefined;
let mockPort = 0;

afterEach(async () => {
	mockServer?.closeAllConnections();
	await new Promise<void>((resolve) => mockServer?.close(() => resolve()));
	mockServer = undefined;
});

/** Mock hosts resolve to the test mock runtime on 127.0.0.1. */
const trafficApp = createDashboardApp({
	logger: createLogger("silent"),
	allowedOrigins: [ORIGIN],
	operations: createTrafficOperations({
		guard: createSsrfGuard({
			resolve: async (host) =>
				host.endsWith(`.${MOCK_DOMAIN}`)
					? [{ address: "127.0.0.1", family: 4 }]
					: [],
			allowAddresses: ["127.0.0.1"],
		}),
		mockOrigin: (secret) => `http://${secret}.${MOCK_DOMAIN}:${mockPort}`,
		timeoutMs: 5_000,
	}),
	auth: {
		router: Router(),
		csrfExempt: [],
		authenticate: async (req) => {
			const sub = req.headers["x-test-sub"];
			return typeof sub === "string" ? { id: `s-${sub}`, sub } : null;
		},
	},
});

async function loggedPost(body: string) {
	const project = await createMockProject();
	await createResource(OWNER, project.id, { name: "users" });
	const mock = kit.client(project.secret);
	mockServer = mock.app.listen(0, "127.0.0.1");
	await new Promise<void>((resolve) => mockServer?.once("listening", resolve));
	mockPort = (mockServer.address() as AddressInfo).port;
	await mock
		.call("post", "/users?src=log")
		.set("authorization", "Bearer secret")
		.set("x-trace", "t1")
		.set("content-type", "application/json")
		.send(body);
	await requestLog.flush();
	const line = await RequestLogModel.findOne().lean<StoredRequestLog>();
	if (!line) throw new Error("no log line");
	return { project, line, path: `/api/v1/projects/${project.id}` };
}

describe("replay and open in API client", () => {
	it("replays through the mock runtime without masked headers", async () => {
		const { project, line, path } = await loggedPost('{"name":"Ada"}');
		const replay = await request(trafficApp)
			.post(`${path}/request-logs/${line._id.toHexString()}/replay`)
			.set("origin", ORIGIN)
			.set("x-test-sub", OWNER)
			.send({});
		expect(replay.status, JSON.stringify(replay.body)).toBe(200);
		expect(replay.body).toMatchObject({ status: 201, source: "mock" });
		expect(JSON.parse(replay.body.body)).toMatchObject({
			id: "2",
			name: "Ada",
		});

		await requestLog.flush();
		const [, replayed] = await RequestLogModel.find()
			.sort({ _id: 1 })
			.lean<StoredRequestLog[]>();
		const names = replayed?.request.headers.map((h) => h.name.toLowerCase());
		expect(names).toContain("x-trace");
		expect(names).not.toContain("authorization");
		expect(replayed?.query).toBe("src=log");
		await kit.meter().flush();
		expect((await readUsage(OWNER)).mockRequests).toBe(2);
		const rows = await as(OWNER).get(`/projects/${project.id}/request-logs`);
		expect(rows.body.items).toHaveLength(2);
	});

	it("refuses a body that was cut in the log", async () => {
		const big = JSON.stringify({ name: "x".repeat(70 * 1024) });
		const { line, path } = await loggedPost(big);
		const replay = await request(trafficApp)
			.post(`${path}/request-logs/${line._id.toHexString()}/replay`)
			.set("origin", ORIGIN)
			.set("x-test-sub", OWNER)
			.send({});
		expect(replay.status).toBe(409);
		expect(replay.body.error.code).toBe("REPLAY_BODY_TRUNCATED");
	});

	it("builds an API client draft of the line", async () => {
		const { project, line } = await loggedPost('{"name":"Ada"}');
		const res = await as(OWNER).get(
			`/projects/${project.id}/request-logs/${line._id.toHexString()}/draft`,
		);
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		const { draft } = res.body;
		expect(draft).toMatchObject({
			method: "POST",
			url: `https://${project.secret}.${MOCK_DOMAIN}/users?src=log`,
			params: [{ key: "src", value: "log", enabled: true }],
			body: { type: "raw", rawLanguage: "json", raw: '{"name":"Ada"}' },
		});
		const auth = draft.headers.find(
			(h: { key: string }) => h.key.toLowerCase() === "authorization",
		);
		expect(auth).toMatchObject({ value: "", enabled: false });
		const trace = draft.headers.find(
			(h: { key: string }) => h.key === "x-trace",
		);
		expect(trace).toMatchObject({ value: "t1", enabled: true });
	});
});
