import request from "supertest";
import { describe, expect, it } from "vitest";
import { createDashboardApp } from "../../dashboard-server.js";
import { createLogger } from "../../logger.js";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { createLocalmanMcpRouter } from "./localman-mcp-server.js";
import { McpHandlerRegistry } from "./mcp-handler-registry.js";
import {
	TEST_ISSUER,
	TEST_PUBLIC_URL,
	createTestIdp,
} from "./testing/idp-token-signer.js";

useDashboardTestDb(() => ({ publicUrl: TEST_PUBLIC_URL }));

/** A promise and the function that settles it. */
function signal(): [Promise<void>, () => void] {
	let settle = (): void => undefined;
	const promise = new Promise<void>((resolve) => {
		settle = resolve;
	});
	return [promise, settle];
}

describe("Localman MCP at shutdown", () => {
	it("answers 503 when shutdown closed the handler during authentication", async () => {
		const registry = new McpHandlerRegistry();
		const logger = createLogger("silent");
		const idp = await createTestIdp();
		const [authenticating, entered] = signal();
		const [gate, resume] = signal();
		const app = createDashboardApp({
			logger,
			allowedOrigins: [TEST_PUBLIC_URL],
			mcp: createLocalmanMcpRouter({
				publicUrl: TEST_PUBLIC_URL,
				issuer: TEST_ISSUER,
				keys: {
					issuer: idp.keys.issuer,
					jwks: async () => {
						entered();
						await gate;
						return idp.keys.jwks();
					},
				},
				allowedOrigins: [TEST_PUBLIC_URL],
				logger,
				handlers: registry,
			}),
		});
		const pending = request(app)
			.post("/mcp")
			.set("authorization", `Bearer ${await idp.sign()}`)
			.set("content-type", "application/json")
			.send({ jsonrpc: "2.0", id: 1, method: "tools/list" })
			.then((res) => res);
		await authenticating;
		await registry.closeAll(() => undefined);
		resume();
		const refused = await pending;
		expect(refused.status).toBe(503);
		expect(refused.body).toMatchObject({ error: { code: "SHUTTING_DOWN" } });
	});
});
