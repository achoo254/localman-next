import http, { type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import express, { type Request } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LogStreamRegistry } from "./log-stream-registry.js";
import { createLogStreamRouter } from "./log-stream-routes.js";
import { RequestLogService } from "./request-log-service.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";

useMockTestKit();

let streams = new LogStreamRegistry();
/** Requests with `x-test-wait` authenticate only once `release` runs. */
let release: () => void = () => undefined;
let entered: Promise<void> = Promise.resolve();
let enter: () => void = () => undefined;

async function resolveAuth(req: Request) {
	if (req.headers["x-test-wait"] !== undefined) {
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		enter();
		await gate;
	}
	return { subjectId: OWNER, scopes: [] };
}

const app = express().use((req, res, next) =>
	createLogStreamRouter({
		resolveAuth,
		service: new RequestLogService(),
		maxPerUser: 1,
		heartbeatMs: 60_000,
		streams,
	})(req, res, next),
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
beforeEach(() => {
	streams = new LogStreamRegistry();
	entered = new Promise((resolve) => {
		enter = resolve;
	});
});

function openStream(projectId: string, wait = false) {
	const url = `${origin}/api/v1/projects/${projectId}/request-logs/stream`;
	const headers = wait ? { "x-test-wait": "1" } : {};
	let request: http.ClientRequest | undefined;
	const response = new Promise<IncomingMessage>((resolve, reject) => {
		request = http.get(url, { headers }, resolve).once("error", reject);
	});
	return { response, abort: () => request?.destroy() };
}

function bodyOf(res: IncomingMessage): Promise<string> {
	return new Promise((resolve) => {
		let text = "";
		res.on("data", (chunk: Buffer) => {
			text += chunk.toString();
		});
		res.once("end", () => resolve(text));
	});
}

describe("live request log lifecycle", () => {
	it("holds no slot for a client that left while authenticating", async () => {
		const project = await createMockProject();
		const early = openStream(project.id, true);
		early.response.catch(() => undefined);
		await entered;
		early.abort();
		await sleep(50);
		release();
		await sleep(50);
		expect(streams.size).toBe(0);
		expect(streams.countOf(OWNER)).toBe(0);
		// One stream per account here: the slot is still free.
		const next = await openStream(project.id).response;
		expect(next.statusCode).toBe(200);
		expect(streams.countOf(OWNER)).toBe(1);
		next.destroy();
		await sleep(50);
		expect(streams.countOf(OWNER)).toBe(0);
	});

	it("ends open streams on shutdown and refuses one still authenticating", async () => {
		const project = await createMockProject();
		const open = await openStream(project.id).response;
		expect(open.statusCode).toBe(200);
		const ended = bodyOf(open);
		const late = openStream(project.id, true);
		await entered;
		streams.close();
		expect(await ended).toContain("retry: 5000");
		release();
		const refused = await late.response;
		expect(refused.statusCode).toBe(503);
		expect(JSON.parse(await bodyOf(refused))).toMatchObject({
			error: { code: "SHUTTING_DOWN" },
		});
		expect(streams.size).toBe(0);
	});
});
