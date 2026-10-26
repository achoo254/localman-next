import type { ServerResponse } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { Router } from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createDashboardApp } from "../../dashboard-server.js";
import { createLogger } from "../../logger.js";
import { as } from "../../test-support/dashboard-test-app.js";
import { RequestLogModel } from "../mock-runtime/request-log-model.js";
import { requestLog } from "../mock-runtime/request-log-service.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import { createResource } from "../resources/testing/resource-fixture.js";
import { createCallbackOperations } from "./callback-operations.js";
import { OutboundJobModel } from "./outbound-job-model.js";
import { OutboundQueue } from "./retry-queue.js";
import { useOutboundTestKit } from "./testing/outbound-test-kit.js";

const kit = useMockTestKit();
const outbound = useOutboundTestKit();
const ORIGIN = "https://localman.test";

/** The dashboard with callback operations on the fake tunnel. */
const callbackApp = createDashboardApp({
	logger: createLogger("silent"),
	allowedOrigins: [ORIGIN],
	operations: createCallbackOperations(outbound.deps),
	auth: {
		router: Router(),
		csrfExempt: [],
		authenticate: async (req) => {
			const sub = req.headers["x-test-sub"];
			return typeof sub === "string" ? { id: `s-${sub}`, sub } : null;
		},
	},
});

const hanging: ServerResponse[] = [];
afterEach(() => {
	for (const res of hanging.splice(0)) res.end();
});

async function usersProject() {
	const project = await createMockProject();
	const users = await createResource(OWNER, project.id, { name: "users" });
	const path = `/api/v1/projects/${project.id}/resources/${users.id}/callbacks`;
	return { ...project, resourceId: users.id, path };
}

describe("callback delivery", () => {
	it("sends a test with the first record and answers the result", async () => {
		outbound.answer("/hooks/test", 201, '{"ok":true}');
		const { path, secret } = await usersProject();
		await kit.client(secret).call("post", "/users", { name: "Ada" });
		const res = await request(callbackApp)
			.post(`${path}/test`)
			.set("origin", ORIGIN)
			.set("x-test-sub", OWNER)
			.send({
				callback: {
					on: "update",
					target: { kind: "tunnel", port: 3000, path: "/hooks/test" },
					bodyTemplate: '{"e":"{{event}}","name":"{{record.name}}"}',
				},
			});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body).toMatchObject({
			target: "tunnel:3000/hooks/test",
			delivery: { ok: true, status: 201, attempts: [{ status: 201 }] },
			response: { status: 201, body: '{"ok":true}', bodyEncoding: "utf8" },
		});
		expect(JSON.parse(outbound.received[0]?.body ?? "")).toEqual({
			e: "update",
			name: "Ada",
		});
		await requestLog.flush();
		const line = await RequestLogModel.findOne({ source: "callback" }).lean();
		expect(line?.event).toBe("update");
	});

	it("reports every attempt of a test that cannot reach the tunnel", async () => {
		const { path } = await usersProject();
		const res = await request(callbackApp)
			.post(`${path}/test`)
			.set("origin", ORIGIN)
			.set("x-test-sub", OWNER)
			.send({
				callback: {
					on: "create",
					target: { kind: "tunnel", port: 4000, path: "/hooks" },
				},
			});
		expect(res.status).toBe(200);
		expect(res.body.delivery).toMatchObject({ ok: false, status: null });
		expect(
			res.body.delivery.attempts.map((a: { error: string }) => a.error),
		).toEqual(["no_tunnel", "no_tunnel", "no_tunnel"]);
		expect(res.body.response).toBeNull();
	});

	it("refuses a test to a private address on its target, sending nothing", async () => {
		const { path } = await usersProject();
		const res = await request(callbackApp)
			.post(`${path}/test`)
			.set("origin", ORIGIN)
			.set("x-test-sub", OWNER)
			.send({
				callback: {
					on: "create",
					target: { kind: "url", url: "https://169.254.169.254/" },
				},
			});
		expect(res.status).toBe(400);
		expect(res.body.error).toMatchObject({
			code: "CALLBACK_URL_BLOCKED",
			details: [{ path: "callback.target.url" }],
		});
		expect(outbound.received).toHaveLength(0);
		await requestLog.flush();
		expect(await RequestLogModel.countDocuments({ source: "callback" })).toBe(
			0,
		);
	});

	it("puts a delivery in flight back on shutdown", async () => {
		outbound.server.routes.set("/hooks/slow", (_req, res) => {
			hanging.push(res);
		});
		const { path, secret } = await usersProject();
		const set = await as(OWNER).send("put", path.replace("/api/v1", ""), {
			callbacks: [
				{
					on: "create",
					target: { kind: "tunnel", port: 3000, path: "/hooks/slow" },
				},
			],
		});
		expect(set.status).toBe(200);
		const queue = new OutboundQueue({ deps: outbound.deps, pollMs: 10 });
		queue.start();
		await kit.client(secret).call("post", "/users", { name: "Slow" });
		for (let i = 0; i < 200 && hanging.length === 0; i++) await sleep(10);
		expect(hanging).toHaveLength(1);

		await queue.stop();
		const job = await OutboundJobModel.findOne().lean();
		expect(job).toMatchObject({ state: "pending", attempts: [] });
		expect(job?.lockedUntil).toBeNull();
		await requestLog.flush();
		expect(await RequestLogModel.countDocuments({ source: "callback" })).toBe(
			0,
		);
	});
});
