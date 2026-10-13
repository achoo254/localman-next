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
