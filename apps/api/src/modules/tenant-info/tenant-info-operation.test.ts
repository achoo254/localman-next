import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger } from "../../logger.js";
import { createIdpTenantDirectory } from "../../tenancy/idp-tenant-directory.js";
import {
	configureTenants,
	singleTenantDirectory,
} from "../../tenancy/tenant-directory.js";
import {
	testApp,
	useDashboardTestDb,
} from "../../test-support/dashboard-test-app.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";

const ACME = {
	id: "ten_AAAAAAAAAAAAAAAA",
	domain: "acme.example",
	displayName: "Acme Inc",
	issuer: "https://auth.acme.example",
	publicUrl: "https://localman.acme.example",
	mockBaseDomain: "localman.acme.example",
	ownerSubs: new Set<string>(),
};

useDashboardTestDb(() => ({
	publicUrl: "https://localman.test",
	mockBaseDomain: "localman.test",
	tunnelDomains: ["tunnel.localman.test"],
}));
beforeAll(() => {
	configureTenants(
		createIdpTenantDirectory({
			primary: TEST_TENANT,
			logger: createLogger("silent"),
			client: {
				byHost: async (host) =>
					host === "localman.acme.example" ? ACME : undefined,
				byId: async () => undefined,
			},
		}),
	);
});
afterAll(() => configureTenants(singleTenantDirectory(TEST_TENANT)));

const info = (host: string) =>
	request(testApp).get("/api/v1/tenant").set("host", host);

describe("GET /tenant", () => {
	it("names the primary tenant by its domain's first label, from its settings", async () => {
		const res = await info("localman.test");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({
			displayName: "localman",
			idpOrigin: "https://auth.localman.test",
			publicUrl: "https://localman.test",
			mockBaseDomain: "localman.test",
			tunnelDomain: "tunnel.localman.test",
		});
	});

	it("describes another tenant from its domain, for guests too", async () => {
		const res = await info("localman.acme.example");
		expect(res.body).toEqual({
			displayName: "Acme Inc",
			idpOrigin: "https://auth.acme.example",
			publicUrl: "https://localman.acme.example",
			mockBaseDomain: "localman.acme.example",
			tunnelDomain: "tunnel.acme.example",
		});
	});
});
