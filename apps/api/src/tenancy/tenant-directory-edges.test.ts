import { TENANT_FRESH_MS, TenantAnswerCache } from "@localman/tenancy";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger.js";
import { createMockApp } from "../mock-server.js";
import { UsageMeter } from "../modules/mock-runtime/usage-meter.js";
import { TEST_TENANT } from "../test-support/test-tenant.js";
import { createIdpTenantDirectory } from "./idp-tenant-directory.js";
import { type LocalmanTenant, setTestDefaultTenant } from "./tenant-context.js";
import { configureTenants, singleTenantDirectory } from "./tenant-directory.js";

const logger = createLogger("silent");
const ACME: LocalmanTenant = {
	...TEST_TENANT,
	id: "ten_AAAAAAAAAAAAAAAA",
	domain: "acme.example",
	publicUrl: "https://localman.acme.example",
	mockBaseDomain: "localman.acme.example",
};

describe("single tenant directory", () => {
	it("serves its own and loopback hosts, never another domain's Localman", async () => {
		const single = singleTenantDirectory(TEST_TENANT);
		for (const host of [
			"localman.test",
			"abc.localman.test",
			"127.0.0.1:4100",
		]) {
			expect(await single.byHost(host), host).toBe(TEST_TENANT);
		}
		expect(await single.byHost("localman.acme.example")).toBeUndefined();
		expect(await single.byHost("abc.localman.acme.example")).toBeUndefined();
	});
});

describe("IdP directory edges", () => {
	it("refuses an answer for another domain than the one asked", async () => {
		const dir = createIdpTenantDirectory({
			primary: TEST_TENANT,
			logger,
			client: { byHost: async () => ACME, byId: async () => undefined },
		});
		expect(await dir.byHost("localman.other.example")).toBeUndefined();
		expect(await dir.byHost("localman.acme.example")).toBe(ACME);
	});

	it("keeps a tenant's answer whatever 404s flood in, and retries a failed refresh later", async () => {
		let time = 0;
		const cache = new TenantAnswerCache(logger, () => time);
		cache.set("domain:acme.example", ACME);
		for (let i = 0; i < 1_500; i++)
			cache.set(`domain:x${i}.example`, undefined);
		time += TENANT_FRESH_MS;
		const down = vi.fn(async () => {
			throw new Error("IdP down");
		});
		expect(await cache.get("domain:acme.example", down)).toBe(ACME);
		expect(await cache.get("domain:acme.example", down)).toBe(ACME);
		expect(down).toHaveBeenCalledTimes(1);
	});
});

describe("mock runtime /healthz on loopback", () => {
	beforeAll(() => {
		setTestDefaultTenant(undefined);
		configureTenants(
			createIdpTenantDirectory({
				primary: TEST_TENANT,
				logger,
				client: { byHost: async () => undefined, byId: async () => undefined },
			}),
		);
	});
	afterAll(() => {
		setTestDefaultTenant(TEST_TENANT);
		configureTenants(singleTenantDirectory(TEST_TENANT));
	});

	it("answers without a tenant, as switch-release probes it", async () => {
		const app = createMockApp({
			logger,
			usageMeter: new UsageMeter({ logger, warn: async () => undefined }),
		});
		const res = await request(app)
			.get("/healthz")
			.set("host", "127.0.0.1:4100");
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ status: "ok" });
		const other = await request(app)
			.get("/users")
			.set("host", "127.0.0.1:4100");
		expect(other.status).toBe(421);
	});
});
