import { PRIMARY_TENANT_ID } from "../tenancy/primary-tenant.js";
import type { TunnelTenant } from "../tenancy/tunnel-tenant.js";
import { TEST_AUDIENCE, TEST_ISSUER } from "./idp-test-keys.js";

/**
 * TEST ONLY. The primary tenant as the tests' environment describes it
 * (`TUNNEL_DOMAINS` of vitest.config.ts, the test IdP keys).
 */
export const TEST_TENANT: TunnelTenant = Object.freeze({
	id: PRIMARY_TENANT_ID,
	domain: "hoandat.com",
	displayName: "hoandat",
	issuer: TEST_ISSUER,
	audience: TEST_AUDIENCE,
	tunnelDomain: "tunnel.hoandat.com",
});
