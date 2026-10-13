import type { LocalmanTenant } from "../tenancy/tenant-context.js";

/**
 * TEST ONLY. The tenant tests run in when they call models directly
 * (`tenant-setup.ts` makes it the default): the primary tenant, as the
 * single-tenant code paths see it.
 */
export const TEST_TENANT: LocalmanTenant = Object.freeze({
	id: "primary",
	domain: "localman.test",
	displayName: "Localman test",
	issuer: "https://auth.localman.test",
	publicUrl: "https://localman.test",
	mockBaseDomain: "localman.test",
	ownerSubs: new Set<string>(),
});
