import express from "express";
import { createLocalJWKSet } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	runInTenant,
	setTestDefaultTenant,
} from "../../tenancy/tenant-context.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import {
	RESOURCE_METADATA_PATH,
	registerResourceMetadataRoutes,
} from "./mcp-resource-metadata.js";
import { tenantMcpSettings } from "./mcp-tenant-settings.js";

const ACME = {
	...TEST_TENANT,
	id: "ten_AAAAAAAAAAAAAAAA",
	issuer: "https://auth.acme.example",
	publicUrl: "https://localman.acme.example",
};

// As at startup: no tenant in scope while the routes are built.
beforeAll(() => setTestDefaultTenant(undefined));
afterAll(() => setTestDefaultTenant(TEST_TENANT));

describe("Localman MCP metadata per tenant", () => {
	it("is built without a tenant and answered for the request's tenant", async () => {
		const router = express.Router();
		registerResourceMetadataRoutes(
			router,
			tenantMcpSettings({
				publicUrl: "https://localman.test",
				issuer: "https://auth.localman.test",
				scopesSupported: ["mock:read"],
				keys: {
					issuer: async () => "",
					jwks: async () => createLocalJWKSet({ keys: [] }),
				},
			}),
		);
		const app = express();
		app.use((req, _res, next) =>
			runInTenant(
				req.hostname === "localman.acme.example" ? ACME : TEST_TENANT,
				next,
			),
		);
		app.use(router);
		const metadata = (host: string) =>
			request(app).get(RESOURCE_METADATA_PATH).set("host", host);
		expect((await metadata("localman.acme.example")).body).toMatchObject({
			resource: "https://localman.acme.example/mcp",
			authorization_servers: ["https://auth.acme.example"],
		});
		expect((await metadata("localman.test")).body).toMatchObject({
			resource: "https://localman.test/mcp",
			authorization_servers: ["https://auth.localman.test"],
		});
	});
});
