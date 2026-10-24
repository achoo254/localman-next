import { setTestDefaultTenant } from "../tenancy/tenant-context.js";
import {
	configureTenants,
	primaryTenantDirectory,
} from "../tenancy/tenant-directory.js";
import { TEST_TENANT } from "./test-tenant.js";

// Vitest setup file: tests that call models outside a request run in the
// test tenant, which serves its own hosts and loopback (supertest's
// `127.0.0.1:<port>`). Tests of the tenant scope itself clear the default.
setTestDefaultTenant(TEST_TENANT);
configureTenants(
	primaryTenantDirectory(TEST_TENANT, { tunnelDomains: [], loopback: true }),
);
