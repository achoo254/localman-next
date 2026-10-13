import type { TenantIdpAccess } from "@localman/tenancy";

export { tenantClientSecret } from "@localman/tenancy";

/** How Localman reaches the IdP for tenants other than the primary one. */
export interface TenantIdpSettings {
	/** The IdP's internal API (`IDP_INTERNAL_URL`). */
	readonly internalUrl: string;
	/** Localman's Basic secret of that API (`IDP_INTERNAL_SECRET`). */
	readonly internalSecret: string;
	/** The IdP's public listener on loopback (`IDP_LOOPBACK_URL`). */
	readonly loopbackUrl: string;
	/** Key of `localman-web` (`LOCALMAN_CLIENT_KEY`). */
	readonly clientKey: string;
}

/** The IdP's internal API and loopback listener, as Localman reaches them. */
export function tenantIdpAccess(settings: TenantIdpSettings): TenantIdpAccess {
	return {
		internalUrl: settings.internalUrl,
		role: "localman",
		internalSecret: settings.internalSecret,
		loopbackUrl: settings.loopbackUrl,
	};
}
