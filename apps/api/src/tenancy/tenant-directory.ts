import type { LocalmanTenant } from "./tenant-context.js";

/**
 * Where Localman learns its tenants: the tenant of a request's Host and
 * the tenant of a stored document's `tenantId` (background work).
 * `undefined`: no such tenant (or not serving).
 */
export interface TenantDirectory {
	byHost(host: string): Promise<LocalmanTenant | undefined>;
	byId(id: string): Promise<LocalmanTenant | undefined>;
}

let directory: TenantDirectory | undefined;

/** Installed by `main.ts` (tests: `tenant-setup.ts`). */
export function configureTenants(next: TenantDirectory): void {
	directory = next;
}

export function tenantDirectory(): TenantDirectory {
	if (!directory) throw new Error("The tenant directory is not configured");
	return directory;
}

/**
 * A single tenant serving every host: Localman as it ran before tenants,
 * the primary tenant built from the environment.
 */
export function singleTenantDirectory(tenant: LocalmanTenant): TenantDirectory {
	return {
		byHost: async () => tenant,
		byId: async (id) => (id === tenant.id ? tenant : undefined),
	};
}
