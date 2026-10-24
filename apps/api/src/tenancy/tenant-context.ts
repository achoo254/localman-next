import { createTenantContext } from "@localman/tenancy";

/**
 * The tenant Localman serves: the primary one (`primary-tenant.ts`),
 * built from the environment. Every document carries its `id`; the scope
 * stays so the `tenantId` filter and stamp of every model keep working.
 */
export interface LocalmanTenant {
	/** Always `primary`, the id every stored document carries. */
	readonly id: string;
	readonly domain: string;
	readonly displayName: string;
	readonly issuer: string;
	/** Origin of the web app and dashboard API. */
	readonly publicUrl: string;
	/** Mock URLs are `{secret}.{mockBaseDomain}`. */
	readonly mockBaseDomain: string;
	/** IdP subjects allowed on admin operations. */
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
