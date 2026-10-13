import { PRIMARY_TENANT_ID } from "./primary-tenant.js";
import { type TunnelTenant, currentTenant } from "./tunnel-tenant.js";

/**
 * The CLI sign-in of a tenant. The CLI's default server is the primary
 * one: another tenant's users must name their own, or they would sign in
 * at the primary IdP and open their tunnels there.
 */
export function tuneloLoginCommand(
	tenant: TunnelTenant = currentTenant(),
): string {
	return tenant.id === PRIMARY_TENANT_ID
		? "tunelo login"
		: `tunelo login --server https://${tenant.tunnelDomain}`;
}
