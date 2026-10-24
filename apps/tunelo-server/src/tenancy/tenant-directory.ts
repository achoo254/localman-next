import { type ServedHosts, isServedHost } from "@localman/tenancy";
import type { TunnelTenant } from "./tunnel-tenant.js";

/**
 * Where Tunelo learns its tenant: the tenant of a Host and of a stored
 * `tenantId`. `undefined`: a host or id Tunelo does not serve.
 */
export interface TenantDirectory {
	byHost(host: string): Promise<TunnelTenant | undefined>;
	byId(id: string): Promise<TunnelTenant | undefined>;
}

/** The hosts Tunelo answers on. */
export interface ServedTunnelHosts {
	/** `TUNNEL_DOMAINS`, each apex with its tunnel subdomains. */
	readonly tunnelDomains: readonly string[];
	/** Loopback hosts (development and tests, never production). */
	readonly loopback: boolean;
}

/**
 * The primary tenant serving only its tunnel domains (apex and every
 * subdomain) and, outside production, loopback. Any other Host (another
 * domain, a bare IP address) gets no tenant: 421, or a refused upgrade.
 */
export function primaryTenantDirectory(
	primary: TunnelTenant,
	hosts: ServedTunnelHosts,
): TenantDirectory {
	const served: ServedHosts = {
		exact: [],
		withSubdomains: hosts.tunnelDomains,
		loopback: hosts.loopback,
	};
	return {
		byHost: async (host) => (isServedHost(served, host) ? primary : undefined),
		byId: async (id) => (id === primary.id ? primary : undefined),
	};
}

let directory: TenantDirectory | undefined;

/** Installed at startup (tests: their own). */
export function configureTenants(next: TenantDirectory): void {
	directory = next;
}

export function tenantDirectory(): TenantDirectory {
	if (!directory) throw new Error("The tenant directory is not configured");
	return directory;
}
