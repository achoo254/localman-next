import {
	createTenantContext,
	createTenantScopePlugin,
} from "@localman/tenancy";

/**
 * One tenant Tunelo serves: a domain claimed at the IdP. Its apex is
 * `tunnel.<domain>`, its tunnels `<subdomain>.tunnel.<domain>`, its users
 * sign in at `https://auth.<domain>`. Every document carries its `id`.
 */
export interface TunnelTenant {
	/** The IdP's tenant id (`primary` for hoandat.com, `ten_…` otherwise). */
	readonly id: string;
	readonly domain: string;
	readonly displayName: string;
	/** `iss` of its users' tokens. */
	readonly issuer: string;
	/** `aud` of tokens for this Tunelo (`https://tunnel.<domain>`). */
	readonly audience: string;
	/** Apex host; tunnel URLs are `https://<subdomain>.<tunnelDomain>`. */
	readonly tunnelDomain: string;
}

/** Tunelo's tenant scope (see `@localman/tenancy`). */
export const tenantContext = createTenantContext<TunnelTenant>();

export const {
	runInTenant,
	runInTenantData,
	acrossTenants,
	findCurrentTenant,
	currentTenant,
	currentTenantId,
	isAcrossTenants,
	tenantKey,
	setTestDefaultTenant,
} = tenantContext;

/** Makes a model tenant-owned in Tunelo's tenant scope. */
export const tenantScopePlugin = createTenantScopePlugin(tenantContext);
