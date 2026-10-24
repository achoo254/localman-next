import { type ServedHosts, isServedHost } from "@localman/tenancy";
import type { LocalmanTenant } from "./tenant-context.js";

/**
 * Where Localman learns its tenant: the tenant of a request's Host and
 * the tenant of a stored document's `tenantId` (background work).
 * `undefined`: a host or id Localman does not serve.
 */
export interface TenantDirectory {
	/** The one tenant served, built from the environment. */
	readonly primary: LocalmanTenant;
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

/** What Localman answers besides the dashboard and mock hosts. */
export interface ExtraHosts {
	/** Tunelo domains (`TUNNEL_DOMAINS`), each with its subdomains. */
	readonly tunnelDomains: readonly string[];
	/** Loopback hosts (development and tests, never production). */
	readonly loopback: boolean;
}

/**
 * The primary tenant serving only its own hosts: the dashboard
 * (`PUBLIC_URL`), the mock base domain and its project subdomains, the
 * Tunelo domains and, outside production, loopback. Any other Host gets
 * no tenant (421), so nothing built from the Host (MCP metadata, links)
 * can name a host this deployment does not own.
 */
export function primaryTenantDirectory(
	tenant: LocalmanTenant,
	extra: ExtraHosts,
): TenantDirectory {
	const served: ServedHosts = {
		exact: [new URL(tenant.publicUrl).host],
		withSubdomains: [tenant.mockBaseDomain, ...extra.tunnelDomains],
		loopback: extra.loopback,
	};
	return {
		primary: tenant,
		byHost: async (host) => (isServedHost(served, host) ? tenant : undefined),
		byId: async (id) => (id === tenant.id ? tenant : undefined),
	};
}
