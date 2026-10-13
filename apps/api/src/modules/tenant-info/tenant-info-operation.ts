import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { PRIMARY_TENANT_ID } from "../../tenancy/primary-tenant.js";
import { currentTenant } from "../../tenancy/tenant-context.js";
import { tenantSettings } from "../../tenancy/tenant-settings.js";

/**
 * What the web shows of the domain it is served on: the account's name
 * ("hoandat account", "Acme account"), its IdP, mock and tunnel hosts.
 * The primary tenant is named by the first label of its domain.
 */
export const getTenantInfo = defineOperation({
	id: "public.getTenantInfo",
	method: "GET",
	path: "/tenant",
	summary: "Get the domain this Localman is served on",
	description:
		"Public. The account name, IdP origin, dashboard URL, mock base domain and tunnel domain of this domain.",
	input: z.object({}),
	output: z.object({
		displayName: z.string(),
		idpOrigin: z.string(),
		publicUrl: z.string(),
		mockBaseDomain: z.string(),
		tunnelDomain: z.string().nullable(),
	}),
	scopes: [],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "public",
	mcp: {
		exempt: "Web đọc để hiện domain và tên tài khoản của chính trang đang mở",
	},
	handler: () => {
		const tenant = currentTenant();
		const settings = tenantSettings(tenant);
		return {
			displayName:
				tenant.id === PRIMARY_TENANT_ID
					? (tenant.domain.split(".")[0] ?? tenant.domain)
					: tenant.displayName,
			idpOrigin: new URL(tenant.issuer).origin,
			publicUrl: settings.publicUrl,
			mockBaseDomain: settings.mockBaseDomain,
			tunnelDomain: settings.tunnelDomains[0] ?? null,
		};
	},
});
