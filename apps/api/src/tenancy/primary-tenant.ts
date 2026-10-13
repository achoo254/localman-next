import type { Env } from "../config/env.js";
import type { LocalmanTenant } from "./tenant-context.js";
import { configureTenants, singleTenantDirectory } from "./tenant-directory.js";

/** The IdP's id of its first tenant (hoandat.com); old data carries it. */
export const PRIMARY_TENANT_ID = "primary";

/**
 * The primary tenant, from the environment Localman always ran with. Its
 * domain is the issuer's host without `auth.` (`auth.hoandat.com` →
 * `hoandat.com`); it never needs the IdP's tenant API.
 */
export function primaryTenantFromEnv(env: Env): LocalmanTenant {
	const issuerHost = new URL(env.OIDC_ISSUER).hostname;
	const domain = issuerHost.replace(/^auth\./, "");
	return Object.freeze({
		id: PRIMARY_TENANT_ID,
		domain,
		displayName: domain,
		issuer: env.OIDC_ISSUER,
		publicUrl: env.PUBLIC_URL,
		mockBaseDomain: env.MOCK_BASE_DOMAIN,
		ownerSubs: new Set(env.OWNER_SUBS),
	});
}

/** Localman before tenants: the primary tenant serves every host. */
export function configurePrimaryTenant(env: Env): void {
	configureTenants(singleTenantDirectory(primaryTenantFromEnv(env)));
}
