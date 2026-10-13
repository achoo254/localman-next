import type { Env } from "../config/env.js";
import type { Logger } from "../logger.js";
import { createIdpTenantClient } from "./idp-tenant-client.js";
import { createIdpTenantDirectory } from "./idp-tenant-directory.js";
import { primaryTenantFromEnv } from "./primary-tenant.js";
import { configureTenants, singleTenantDirectory } from "./tenant-directory.js";

/**
 * Installs the tenant directory: without the IdP's internal API, the
 * primary tenant serves every host (Localman before tenants); with it,
 * other `localman.<domain>` hosts are the IdP's tenants.
 */
export function configureTenancy(env: Env, logger: Logger): void {
	const primary = primaryTenantFromEnv(env);
	const { IDP_INTERNAL_URL, IDP_INTERNAL_SECRET } = env;
	if (!IDP_INTERNAL_URL || !IDP_INTERNAL_SECRET) {
		configureTenants(singleTenantDirectory(primary));
		return;
	}
	const client = createIdpTenantClient(IDP_INTERNAL_URL, IDP_INTERNAL_SECRET);
	configureTenants(createIdpTenantDirectory({ primary, client, logger }));
}
