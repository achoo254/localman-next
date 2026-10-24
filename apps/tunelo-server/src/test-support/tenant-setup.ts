import { configureTenants } from "../tenancy/tenant-directory.js";
import { setTestDefaultTenant } from "../tenancy/tunnel-tenant.js";
import { TEST_TENANT, testTenantDirectory } from "./test-tenant.js";

// Vitest setup file: code called outside a request runs in the primary
// tenant, which serves its tunnel domains and loopback unless a test
// configures another directory.
setTestDefaultTenant(TEST_TENANT);
configureTenants(testTenantDirectory());
