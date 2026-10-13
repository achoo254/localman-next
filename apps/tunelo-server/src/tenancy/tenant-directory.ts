import {
	type IdpTenantApi,
	type TenancyLogger,
	TenantAnswerCache,
	type TenantSummary,
	appDomainOf,
} from "@localman/tenancy";
import { tunnelDomains } from "../config/tunnel-domains.js";
import type { TunnelTenant } from "./tunnel-tenant.js";

/**
 * Where Tunelo learns its tenants: the tenant of a Host and of a stored
 * `tenantId`. `undefined`: no such tenant (or not serving).
 */
export interface TenantDirectory {
	byHost(host: string): Promise<TunnelTenant | undefined>;
	byId(id: string): Promise<TunnelTenant | undefined>;
}

/** Hosts of the primary tenant: every `TUNNEL_DOMAINS` apex and its subdomains. */
function isPrimaryHost(hostname: string): boolean {
	return tunnelDomains().some(
		(domain) => hostname === domain || hostname.endsWith(`.${domain}`),
	);
}

const hostnameOf = (host: string): string =>
	host.toLowerCase().replace(/:\d+$/, "");

/**
 * Without the IdP's tenant API: the primary tenant serves its own hosts
 * and loopback/dev hosts, never another domain's `tunnel.` hosts.
 */
export function singleTenantDirectory(primary: TunnelTenant): TenantDirectory {
	return {
		byHost: async (host) => {
			const hostname = hostnameOf(host);
			if (isPrimaryHost(hostname)) return primary;
			return appDomainOf(hostname, "tunnel") === undefined
				? primary
				: undefined;
		},
		byId: async (id) => (id === primary.id ? primary : undefined),
	};
}

function toTenant(summary: TenantSummary): TunnelTenant {
	const tunnel = new URL(summary.resources.tunnel);
	return Object.freeze({
		id: summary.id,
		domain: summary.domain,
		displayName: summary.displayName,
		issuer: summary.issuer,
		audience: tunnel.origin,
		tunnelDomain: tunnel.host,
	});
}

/**
 * The primary tenant from the environment for its own hosts (never asks
 * the IdP, so hoandat.com runs while the IdP is down), every other
 * `tunnel.<d>` host from the IdP's internal API through a cache that
 * keeps the last answer while the IdP fails.
 */
export function idpTenantDirectory(options: {
	readonly primary: TunnelTenant;
	readonly api: IdpTenantApi;
	readonly logger: TenancyLogger;
	readonly now?: () => number;
}): TenantDirectory {
	const { primary, api } = options;
	const cache = new TenantAnswerCache<TunnelTenant>(
		options.logger,
		options.now,
	);
	const settle = (
		answer: TunnelTenant | undefined,
		domain?: string,
	): TunnelTenant | undefined => {
		if (answer?.id === primary.id) return primary;
		if (!answer || (domain !== undefined && answer.domain !== domain)) {
			return undefined;
		}
		cache.set(`id:${answer.id}`, answer);
		return answer;
	};
	const tenantOf = (summary: TenantSummary | undefined) =>
		summary ? toTenant(summary) : undefined;
	return {
		async byHost(host) {
			const hostname = hostnameOf(host);
			if (isPrimaryHost(hostname)) return primary;
			const domain = appDomainOf(hostname, "tunnel");
			if (!domain) return undefined;
			const answer = await cache.get(`domain:${domain}`, async () =>
				tenantOf(await api.byHost(`tunnel.${domain}`)),
			);
			return settle(answer, domain);
		},
		async byId(id) {
			if (id === primary.id) return primary;
			const answer = await cache.get(`id:${id}`, async () =>
				tenantOf(await api.byId(id)),
			);
			return settle(answer);
		},
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
