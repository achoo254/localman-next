import {
	configureTenants,
	singleTenantDirectory,
} from "../tenancy/tenant-directory.js";
import { setTestDefaultTenant } from "../tenancy/tunnel-tenant.js";
import { TEST_TENANT } from "./test-tenant.js";

// Vitest setup file: code called outside a request runs in the primary
// tenant, and every host is served by it unless a test configures more.
setTestDefaultTenant(TEST_TENANT);
configureTenants(singleTenantDirectory(TEST_TENANT));
