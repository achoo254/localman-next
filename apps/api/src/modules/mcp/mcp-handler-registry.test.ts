import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
	Client,
	StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
	type McpHttpHandler,
	McpServer,
	createMcpHandler,
} from "@modelcontextprotocol/server";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createDashboardApp } from "../../dashboard-server.js";
import { closeServer } from "../../http/close-server.js";
import { createLogger } from "../../logger.js";
import { createLocalmanMcpRouter } from "./localman-mcp-server.js";
import { sendFetchResponse, toFetchRequest } from "./mcp-fetch-bridge.js";
import { McpHandlerRegistry } from "./mcp-handler-registry.js";
import {
	TEST_ISSUER,
	TEST_PUBLIC_URL,
	createTestIdp,
} from "./testing/idp-token-signer.js";

const servers: Server[] = [];

afterEach(() => {
	for (const server of servers.splice(0)) server.closeAllConnections();
});

function newHandler(): McpHttpHandler {
	return createMcpHandler(
		() =>
			new McpServer(
				{ name: "registry-test", version: "0.0.0" },
				{ capabilities: { tools: { listChanged: true } } },
			),
		{ legacy: "reject" },
	);
}

/** `handler` on `/mcp` of a loopback server, through the app's bridge. */
async function serve(handler: McpHttpHandler): Promise<[Server, string]> {
	const app = express();
	app.all("/mcp", async (req, res) => {
		const abort = new AbortController();
		res.once("close", () => abort.abort());
		const url = `http://${req.headers.host ?? "localhost"}${req.originalUrl}`;
		const request = await toFetchRequest(req, url, abort.signal);
		await sendFetchResponse(await handler.fetch(request), res);
	});
	const server = await new Promise<Server>((resolve) => {
		const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
	});
	servers.push(server);
	const address: AddressInfo | string | null = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP address");
	}
	return [server, `http://127.0.0.1:${address.port}/mcp`];
}

function within<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
	return Promise.race([
		promise,
		new Promise<"timeout">((resolve) => setTimeout(resolve, ms, "timeout")),
	]);
}

describe("McpHandlerRegistry", () => {
	it("ends open subscription streams so the HTTP server can close", async () => {
		const registry = new McpHandlerRegistry();
		const handler = newHandler();
		registry.track(handler);
		const [server, url] = await serve(handler);
		const client = new Client(
			{ name: "test", version: "0.0.0" },
			{ versionNegotiation: { mode: { pin: "2026-07-28" } } },
		);
		await client.connect(new StreamableHTTPClientTransport(new URL(url)));
		const subscription = await client.listen({ toolsListChanged: true });

		// Closing the server (as main.ts does) waits for the open stream:
		// without the registry, shutdown would hang until the forced exit.
		const closing = closeServer(server);
		expect(await within(closing, 300)).toBe("timeout");

		await registry.closeAll(() => undefined);
		expect(await within(closing, 2_000)).toBeUndefined();
		expect(await within(subscription.closed, 2_000)).not.toBe("timeout");
		await client.close();
	});

	it("closes every handler even when one fails, and reports the failure", async () => {
		const registry = new McpHandlerRegistry();
		const failure = new Error("close failed");
		const closed: string[] = [];
		const fake = (name: string, fail: boolean): McpHttpHandler => ({
			...newHandler(),
			close: async () => {
				closed.push(name);
				if (fail) throw failure;
			},
		});
		registry.track(fake("a", true));
		registry.track(fake("b", false));
		const release = registry.track(fake("c", false));
		release();

		const errors: unknown[] = [];
		await registry.closeAll((error) => errors.push(error));
		expect(closed.sort()).toEqual(["a", "b"]);
		expect(errors).toEqual([failure]);
	});

	it("refuses new exchanges and closes a handler tracked after shutdown at once", async () => {
		const registry = new McpHandlerRegistry();
		expect(() => registry.assertOpen()).not.toThrow();
		const errors: unknown[] = [];
		await registry.closeAll((error) => errors.push(error));
		expect(() => registry.assertOpen()).toThrow(
			expect.objectContaining({ status: 503, code: "SHUTTING_DOWN" }),
		);
		const failure = new Error("late close failed");
		let closes = 0;
		registry.track({
			...newHandler(),
			close: async () => {
				closes += 1;
				throw failure;
			},
		});
		expect(closes).toBe(1);
		await new Promise((resolve) => setImmediate(resolve));
		expect(errors).toEqual([failure]);
		// Closed once only: a second closeAll finds nothing tracked.
		await registry.closeAll(() => undefined);
		expect(closes).toBe(1);
	});

	it("answers 503 on Localman MCP once shutdown closed the handlers", async () => {
		const registry = new McpHandlerRegistry();
		const logger = createLogger("silent");
		const app = createDashboardApp({
			logger,
			allowedOrigins: [TEST_PUBLIC_URL],
			mcp: createLocalmanMcpRouter({
				publicUrl: TEST_PUBLIC_URL,
				issuer: TEST_ISSUER,
				keys: (await createTestIdp()).keys,
				allowedOrigins: [TEST_PUBLIC_URL],
				logger,
				handlers: registry,
			}),
		});
		const post = () =>
			request(app)
				.post("/mcp")
				.set("content-type", "application/json")
				.send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
		expect((await post()).status).toBe(401);

		await registry.closeAll(() => undefined);
		const refused = await post();
		expect(refused.status).toBe(503);
		expect(refused.body).toMatchObject({ error: { code: "SHUTTING_DOWN" } });
	});
});
