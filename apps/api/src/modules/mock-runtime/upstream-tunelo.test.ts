import type { ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { testGuard, useTestServer } from "../api-client/proxy-test-server.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "./testing/mock-test-kit.js";
import { createUpstreamDeps } from "./upstream-proxy.js";
import { tuneloFailureOf } from "./upstream-tunelo.js";

/** Plays the Tunelo server (and the CLI behind it) for the owner's port 3000. */
const tunelo = useTestServer();
const kit = useMockTestKit({
	upstream: () =>
		createUpstreamDeps({
			guard: testGuard(),
			timeoutMs: 5_000,
			findTunnel: async () => tunelo.origin,
		}),
});

/** Answers exactly as Tunelo does: `writeHead(status, { "content-type": "text/plain" })`. */
function answer(path: string, status: number, type: string, body: string) {
	tunelo.routes.set(path, (_req, res: ServerResponse) => {
		res.writeHead(status, { "content-type": type });
		res.end(body);
	});
}

answer("/gone", 502, "text/plain", "Tunnel not found: myapp");
answer("/relay-failed", 502, "text/plain", "Bad Gateway");
answer("/relay-timeout", 504, "text/plain", "Gateway Timeout");
answer("/refused", 502, "text/plain", "Local service unavailable");
answer("/local-timeout", 504, "text/plain", "Local service timeout");
answer("/reset", 502, "text/plain", "read ECONNRESET");
answer("/app-json", 502, "application/json", '{"error":"db down"}');
answer("/app-text", 502, "text/plain; charset=utf-8", "Bad Gateway");
answer("/app-other", 502, "text/plain", "upstream payment provider failed");

async function tunnelMock() {
	const project = await createMockProject();
	const set = await as(OWNER).send("put", `/projects/${project.id}/upstream`, {
		upstream: { kind: "tunnel", port: 3000 },
	});
	expect(set.status, JSON.stringify(set.body)).toBe(200);
	return kit.client(project.secret);
}

describe("hybrid mock upstream behind a stopped tunnel", () => {
	it.each([
		["/gone", "connect"],
		["/relay-failed", "connect"],
		["/relay-timeout", "timeout"],
		["/refused", "connect"],
		["/local-timeout", "timeout"],
		["/reset", "connect"],
	])(
		"turns Tunelo's answer on %s into UPSTREAM_UNAVAILABLE",
		async (path, cause) => {
			const mock = await tunnelMock();
			const res = await mock.get(path);
			expect(res.status).toBe(502);
			expect(res.headers["x-localman-source"]).toBe("upstream");
			expect(res.body.error).toMatchObject({
				code: "UPSTREAM_UNAVAILABLE",
				hint: "tunelo http 3000",
				details: { cause, port: 3000 },
			});
			expect(res.body.error.message).toContain("3000");
		},
	);

	it.each([
		["/app-json", '{"error":"db down"}'],
		["/app-text", "Bad Gateway"],
		["/app-other", "upstream payment provider failed"],
	])("keeps the app's own 502 on %s", async (path, body) => {
		const mock = await tunnelMock();
		const res = await mock.get(path);
		expect(res.status).toBe(502);
		expect(res.text).toBe(body);
	});

	it("knows Tunelo by status, bare text/plain and a short known body", () => {
		const headers = [{ name: "Content-Type", value: "text/plain" }];
		const body = Buffer.from("Tunnel not found: myapp");
		expect(tuneloFailureOf({ status: 502, headers, body })).toBe("connect");
		expect(tuneloFailureOf({ status: 500, headers, body })).toBeNull();
		const long = Buffer.from(`Tunnel not found: ${"a".repeat(300)}`);
		expect(tuneloFailureOf({ status: 502, headers, body: long })).toBeNull();
	});
});
