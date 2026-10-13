import { PRIMARY_TENANT_ID } from "../../tenancy/primary-tenant.js";
import { currentTenant } from "../../tenancy/tenant-context.js";
import type { McpResourceSettings } from "./mcp-resource-metadata.js";

/**
 * The MCP resource of the request's tenant, read at each use: another
 * tenant's is `https://localman.<domain>/mcp`, served for its IdP
 * `https://auth.<domain>`; the primary tenant keeps the configured ones.
 * Keys follow the tenant through the OIDC client.
 */
export function tenantMcpSettings(
	primary: McpResourceSettings,
): McpResourceSettings {
	const other = () => {
		const tenant = currentTenant();
		return tenant.id === PRIMARY_TENANT_ID ? undefined : tenant;
	};
	return {
		get publicUrl() {
			return other()?.publicUrl ?? primary.publicUrl;
		},
		get issuer() {
			return other()?.issuer ?? primary.issuer;
		},
		scopesSupported: primary.scopesSupported,
		keys: primary.keys,
	};
}
