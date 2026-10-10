import http, { type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	createResource,
	generate,
} from "../resources/testing/resource-fixture.js";
import { createLogStreamRouter } from "./log-stream-routes.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

const kit = useMockTestKit();

/** The router alone, signed in by `x-test-sub`, one stream per account. */
const app = express().use(
	createLogStreamRouter({
		resolveAuth: (req) => {
			const sub = req.headers["x-test-sub"];
			return typeof sub === "string" ? { subjectId: sub, scopes: [] } : null;
		},
		maxPerUser: 1,
		heartbeatMs: 60_000,
	}),
);
let server: Server;
let origin = "";

beforeAll(async () => {
	server = app.listen(0, "127.0.0.1");
	await new Promise<void>((resolve) => server.once("listening", resolve));
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
	server.closeAllConnections();
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

function openStream(
	projectId: string,
	query: string,
	sub: string | null = OWNER,
): Promise<IncomingMessage> {
	const url = `${origin}/api/v1/projects/${projectId}/request-logs/stream${query}`;
	return new Promise((resolve, reject) => {
		const headers = sub === null ? {} : { "x-test-sub": sub };
		http.get(url, { headers }, resolve).once("error", reject);
	});
}

/** Collects `event: log` payloads until `count` arrived. */
function nextEvents(res: IncomingMessage, count: number): Promise<unknown[]> {
	return new Promise((resolve) => {
		let text = "";
		res.on("data", (chunk: Buffer) => {
			text += chunk.toString();
			const events = text
				.split("\n\n")
				.filter((block) => block.includes("event: log"))
				.map((block) => {
					const data = block.split("\n").find((l) => l.startsWith("data: "));
					return JSON.parse(data?.slice(6) ?? "null") as unknown;
				});
			if (events.length >= count) resolve(events);
		});
	});
}

describe("live request log (SSE)", () => {
	it("streams new lines of the project that pass the filters", async () => {
		const project = await createMockProject();
		const users = await createResource(OWNER, project.id, { name: "users" });
		await generate(OWNER, project.id, users.id, 1);
		const res = await openStream(project.id, "?method=POST&status=2xx");
		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("text/event-stream");
		const events = nextEvents(res, 1);
		const mock = kit.client(project.secret);
		await mock.get("/users");
		await mock.call("post", "/users/9", { name: "x" });
		await mock.call("post", "/users", { name: "Ada" });
		const [event] = await events;
		expect(event).toMatchObject({
			method: "POST",
			path: "/users",
			status: 201,
			source: "mock",
		});
		// One stream per account here: the second is refused.
		const second = await openStream(project.id, "");
		expect(second.statusCode).toBe(429);
		res.destroy();
	});

	it("is for members only", async () => {
		const project = await createMockProject();
		expect((await openStream(project.id, "", null)).statusCode).toBe(401);
		expect((await openStream(project.id, "", "acc_nobody")).statusCode).toBe(
			404,
		);
		const bad = await openStream(project.id, "?status=nope");
		expect(bad.statusCode).toBe(400);
		// The project exists for the owner through the dashboard too.
		expect((await as(OWNER).get(`/projects/${project.id}`)).status).toBe(200);
	});
});
