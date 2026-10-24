import type { Env } from "../config/env.js";
import { primaryTenantFromEnv } from "./primary-tenant.js";
import {
	configureTenants,
	primaryTenantDirectory,
} from "./tenant-directory.js";

/**
 * Installs the tenant directory: the primary tenant from the environment,
 * served on its own hosts only (loopback too outside production).
 */
export function configureTenancy(env: Env): void {
	configureTenants(
		primaryTenantDirectory(primaryTenantFromEnv(env), {
			tunnelDomains: env.TUNNEL_DOMAINS,
			loopback: env.NODE_ENV !== "production",
		}),
	);
}
