import { createTenantScopePlugin } from "@localman/tenancy";
import { tenantContext } from "./tenant-context.js";

export {
	TENANT_SCOPED,
	type TenantScopeOptions,
	storedTenantId,
} from "@localman/tenancy";

/** Makes a model tenant-owned in Localman's tenant scope. */
export const tenantScopePlugin = createTenantScopePlugin(tenantContext);
