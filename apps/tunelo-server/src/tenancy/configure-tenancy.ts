import mongoose from "mongoose";
import type { AuthConfig } from "../config/auth-config.js";
import { tunnelDomains } from "../config/tunnel-domains.js";
import { primaryTenantFromEnv } from "./primary-tenant.js";
import {
	configureTenants,
	primaryTenantDirectory,
} from "./tenant-directory.js";

/**
 * Installs the tenant directory: the primary tenant from the environment,
 * served on its `TUNNEL_DOMAINS` (and loopback outside production) only.
 */
export function configureTenancy(
	auth: AuthConfig,
	env: NodeJS.ProcessEnv = process.env,
): void {
	configureTenants(
		primaryTenantDirectory(primaryTenantFromEnv(auth), {
			tunnelDomains: tunnelDomains(),
			loopback: env.NODE_ENV !== "production",
		}),
	);
}

/** After connecting: builds every index (tenant-prefixed) of the models. */
export async function initModels(): Promise<void> {
	await Promise.all(
		mongoose.modelNames().map((name) => mongoose.model(name).init()),
	);
}
