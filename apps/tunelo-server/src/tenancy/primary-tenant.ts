import type { AuthConfig } from "../config/auth-config.js";
import { primaryTunnelDomain } from "../config/tunnel-domains.js";
import type { TunnelTenant } from "./tunnel-tenant.js";

/** The IdP's id of its first tenant (hoandat.com); old data carries it. */
export const PRIMARY_TENANT_ID = "primary";

/**
 * The primary tenant, from the environment Tunelo always ran with (first
 * `TUNNEL_DOMAINS` entry, `AUTH_ISSUER`, `AUTH_AUDIENCE`); it never needs
 * the IdP's tenant API.
 */
export function primaryTenantFromEnv(auth: AuthConfig): TunnelTenant {
	const tunnelDomain = primaryTunnelDomain();
	const domain = tunnelDomain.replace(/^tunnel\./, "");
	return Object.freeze({
		id: PRIMARY_TENANT_ID,
		domain,
		displayName: domain.split(".")[0] ?? domain,
		issuer: auth.issuer,
		audience: auth.audience,
		tunnelDomain,
	});
}
