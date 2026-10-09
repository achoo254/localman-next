import type { Router } from "express";
import { describe, expect, it } from "vitest";
import { createLogger } from "../logger.js";
import { createAuthModule } from "../modules/auth/auth-module.js";
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
			routes.push(`${method.toUpperCase()} ${path}`);
		}
	}
	return routes;
}

describe("protocol route manifest", () => {
	it("lists exactly the routes the auth router mounts, each with a reason", () => {
		const auth = createAuthModule(
			{
				issuer: "https://auth.example",
				clientId: "localman-web",
				clientSecret: "secret",
				publicUrl: "https://localman.example",
				sessionEncryptionKey: `k1:${Buffer.alloc(32, 1).toString("base64")}`,
				audit: { clientId: "hoandat-auth", clientSecret: "x".repeat(32) },
			},
			createLogger("silent"),
		);
		expect(mountedRoutes(auth.router).sort()).toEqual(
			PROTOCOL_ROUTES.map((r) => `${r.method} ${r.path}`).sort(),
		);
		for (const route of PROTOCOL_ROUTES) {
			expect(route.mcpExempt.trim()).not.toBe("");
		}
	});
});
