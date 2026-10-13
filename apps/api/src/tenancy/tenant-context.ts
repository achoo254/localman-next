import { createTenantContext } from "@localman/tenancy";

/**
 * One tenant Localman serves: a domain claimed at the IdP. Its dashboard
 * is `localman.<domain>`, its mocks `*.localman.<domain>`, its users sign
 * in at `https://auth.<domain>`. Every document carries its `id`.
 */
export interface LocalmanTenant {
	/** The IdP's tenant id (`primary` for hoandat.com, `ten_…` otherwise). */
	readonly id: string;
	readonly domain: string;
	readonly displayName: string;
	readonly issuer: string;
	/** Origin of the web app and dashboard API. */
	readonly publicUrl: string;
	/** Mock URLs are `{secret}.{mockBaseDomain}`. */
	readonly mockBaseDomain: string;
	/** IdP subjects allowed on admin operations in this tenant. */
	readonly ownerSubs: ReadonlySet<string>;
}

/** Localman's tenant scope (see `@localman/tenancy`). */
export const tenantContext = createTenantContext<LocalmanTenant>();

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
