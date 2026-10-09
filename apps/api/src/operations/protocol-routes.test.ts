import { MOCK_MCP_SEGMENT } from "@localman/shared";
import type { Router } from "express";
import { describe, expect, it } from "vitest";
import { createLogger } from "../logger.js";
import { createAuthModule } from "../modules/auth/auth-module.js";
import { createLocalmanMcpRouter } from "../modules/mcp/localman-mcp-server.js";
import { PROTOCOL_ROUTES } from "./protocol-routes.js";

/** `METHOD path` of every route mounted directly on the router. */
function mountedRoutes(router: Router): string[] {
	const routes: string[] = [];
	for (const layer of router.stack) {
		const route: unknown = layer.route;
		if (typeof route !== "object" || route === null) continue;
		const path = "path" in route ? route.path : undefined;
		const methods = "methods" in route ? route.methods : undefined;
		if (typeof path !== "string" || typeof methods !== "object" || !methods) {
			continue;
		}
		for (const method of Object.keys(methods)) {
			// Express records `router.all` as the `_all` method.
			const name = method === "_all" ? "ALL" : method.toUpperCase();
			routes.push(`${name} ${path}`);
		}
	}
	return routes;
}

function manifestOf(server: "dashboard" | "mock"): string[] {
	return PROTOCOL_ROUTES.filter((r) => r.server === server).flatMap((r) =>
		r.methods.map((method) => `${method} ${r.path}`),
	);
}

describe("protocol route manifest", () => {
	it("lists exactly the dashboard routes the auth and MCP routers mount", () => {
		const logger = createLogger("silent");
		const publicUrl = "https://localman.example";
		const auth = createAuthModule(
			{
				issuer: "https://auth.example",
				clientId: "localman-web",
				clientSecret: "secret",
				publicUrl,
				sessionEncryptionKey: `k1:${Buffer.alloc(32, 1).toString("base64")}`,
				audit: { clientId: "hoandat-auth", clientSecret: "x".repeat(32) },
			},
			logger,
		);
		const mcp = createLocalmanMcpRouter({
			publicUrl,
			issuer: "https://auth.example",
			keys: auth.oidc,
			allowedOrigins: [publicUrl],
			logger,
		});
		expect(
			[...mountedRoutes(auth.router), ...mountedRoutes(mcp)].sort(),
		).toEqual(manifestOf("dashboard").sort());
	});

	it("lists the Hosted Mock MCP endpoint of the mock runtime", () => {
		const mock = manifestOf("mock");
		expect(mock).toEqual([expect.stringMatching(/^ALL \//)]);
		expect(mock[0]?.endsWith(`/${MOCK_MCP_SEGMENT}`)).toBe(true);
	});

	it("gives every route a reason for having no MCP tool", () => {
		for (const route of PROTOCOL_ROUTES) {
			expect(route.mcpExempt.trim()).not.toBe("");
			expect(route.methods.length).toBeGreaterThan(0);
		}
	});
});
