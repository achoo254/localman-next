import { setTestDefaultTenant } from "../tenancy/tenant-context.js";
import {
	configureTenants,
	singleTenantDirectory,
} from "../tenancy/tenant-directory.js";
import { TEST_TENANT } from "./test-tenant.js";

// Vitest setup file: tests that call models outside a request run in the
// test tenant, and every host is served by it. Tests of the tenant scope
// itself clear the default.
setTestDefaultTenant(TEST_TENANT);
configureTenants(singleTenantDirectory(TEST_TENANT));
