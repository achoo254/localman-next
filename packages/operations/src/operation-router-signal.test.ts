import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { defineOperation } from "./define-operation.js";
import { createOperationRouter } from "./operation-router.js";

/** Signals the handlers saw, and a hook fired when a slow handler starts. */
const seen: AbortSignal[] = [];
let slowStarted: () => void = () => {};

const slow = defineOperation({
	id: "client.waitSlow",
	method: "POST",
	path: "/slow",
	summary: "Waits until the caller goes away",
	input: z.object({ note: z.string() }),
	output: z.object({ aborted: z.boolean() }),
	scopes: [],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx) => {
		const { signal } = ctx;
		if (!signal) throw new Error("the router must pass a signal");
		seen.push(signal);
		slowStarted();
		await once(signal, "abort");
		return { aborted: true };
	},
});

const quick = defineOperation({
	id: "client.answerQuick",
	method: "POST",
	path: "/quick",
	summary: "Answers at once",
	input: z.object({ note: z.string() }),
	output: z.object({ ok: z.boolean() }),
	scopes: [],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: (ctx) => {
		if (ctx.signal) seen.push(ctx.signal);
		return { ok: true };
	},
});

const app = express();
app.use(express.json());
app.use(createOperationRouter([slow, quick], { resolveAuth: () => null }));
const server = http.createServer(app);
let port = 0;

beforeAll(async () => {
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
	server.closeAllConnections();
	server.close();
	await once(server, "close");
});

function post(path: string): http.ClientRequest {
	const body = JSON.stringify({ note: "x" });
	const req = http.request({
		host: "127.0.0.1",
		port,
		path,
		method: "POST",
		headers: { "content-type": "application/json" },
	});
	req.on("error", () => {});
	req.end(body);
	return req;
}

describe("operation router: ctx.signal", () => {
	it("aborts when the client disconnects before the answer", async () => {
		seen.length = 0;
		const started = new Promise<void>((resolve) => {
			slowStarted = resolve;
		});
		const req = post("/slow");
		await started;
		// The body was read in full, yet the caller is still there.
		expect(seen[0]?.aborted).toBe(false);
		req.destroy();
		const [signal] = seen;
		if (!signal) throw new Error("handler did not run");
		if (!signal.aborted) await once(signal, "abort");
		expect(signal.aborted).toBe(true);
	});

	it("never aborts once the response was sent", async () => {
		seen.length = 0;
		const req = post("/quick");
		const [res] = (await once(req, "response")) as [http.IncomingMessage];
		res.resume();
		await once(res, "end");
		expect(res.statusCode).toBe(200);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(seen).toHaveLength(1);
		expect(seen[0]?.aborted).toBe(false);
	});
});
