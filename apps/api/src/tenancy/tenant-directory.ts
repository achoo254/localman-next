import { localmanDomainOf } from "./idp-tenant-directory.js";
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
 * A single tenant serving its hosts and any host that is not another
 * domain's `localman.` (loopback, dev ports): Localman as it ran before
 * tenants, the primary tenant built from the environment. Another
 * domain's Localman hosts get no tenant (421), so tenant server blocks
 * installed ahead of the tenant settings never show the primary's data.
 */
export function singleTenantDirectory(tenant: LocalmanTenant): TenantDirectory {
	return {
		byHost: async (host) => {
			const domain = localmanDomainOf(host.toLowerCase());
			const other =
				domain !== undefined &&
				domain !== tenant.domain &&
				!domain.endsWith(`.${tenant.domain}`);
			return other ? undefined : tenant;
		},
		byId: async (id) => (id === tenant.id ? tenant : undefined),
	};
}
