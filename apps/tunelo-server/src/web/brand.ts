import { currentTenant } from "../tenancy/tunnel-tenant.js";

/**
 * The account name and IdP host of the tenant whose console renders
 * ("hoandat", `auth.hoandat.com`), for `{brand}` and `{idpHost}`.
 */
export function brandValues(): { brand: string; idpHost: string } {
	const tenant = currentTenant();
	return {
		brand: tenant.displayName,
		idpHost: new URL(tenant.issuer).host,
	};
}

/**
 * Footer links of the tenant: its home (`<domain>`) and Localman's web app,
 * whose privacy policy and terms cover the suite Tunelo belongs to.
 */
export function footLinks(): { domain: string; localmanUrl: string } {
	const { domain } = currentTenant();
	return { domain, localmanUrl: `https://localman.${domain}` };
}
