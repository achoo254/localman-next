import { toMcpToolDescriptor } from "@localman/operations";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDashboardApp } from "../../dashboard-server.js";
import { createLogger } from "../../logger.js";
import { createIdpTenantDirectory } from "../../tenancy/idp-tenant-directory.js";
import {
	configureTenants,
	singleTenantDirectory,
} from "../../tenancy/tenant-directory.js";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import { generateFakeData } from "./fake-data-operation.js";
import { FAKE_DATA_LIMIT_PER_MINUTE } from "./fake-data-rate-limit.js";

const ACME = {
	id: "ten_AAAAAAAAAAAAAAAA",
	domain: "acme.example",
	displayName: "Acme Inc",
	issuer: "https://auth.acme.example",
	publicUrl: "https://localman.acme.example",
	mockBaseDomain: "localman.acme.example",
	ownerSubs: new Set<string>(),
};

const app = createDashboardApp({
	logger: createLogger("silent"),
	allowedOrigins: ["https://localman.test"],
	trustProxy: "loopback",
	operations: [generateFakeData],
});

useDashboardTestDb(() => ({
	publicUrl: "https://localman.test",
	mockBaseDomain: "localman.test",
}));
beforeAll(() => {
	configureTenants(
		createIdpTenantDirectory({
			primary: TEST_TENANT,
			logger: createLogger("silent"),
			client: {
				byHost: async (host) =>
					host === "localman.acme.example" ? ACME : undefined,
				byId: async () => undefined,
			},
		}),
	);
});
afterAll(() => configureTenants(singleTenantDirectory(TEST_TENANT)));

/** A guest (no session cookie) calling from `ip` on `host`. */
const fakeData = (query: string, ip: string, host = "localman.test") =>
	request(app)
		.get(`/api/v1/public/fake-data${query}`)
		.set("host", host)
		.set("x-forwarded-for", ip);

describe("GET /public/fake-data", () => {
	it("answers a guest with fake records marked as such, nothing to sign in", async () => {
		const res = await fakeData("?type=cccd&count=5", "203.0.113.1");
		expect(res.status).toBe(200);
		expect(res.headers["cache-control"]).toBe("no-store");
		expect(res.body).toMatchObject({
			fake: true,
			type: "cccd",
			locale: "vi",
		});
		expect(res.body.notice).toMatch(/fake data for testing only/i);
		expect(res.body.items).toHaveLength(5);
		for (const item of res.body.items) {
			expect(item.number).toMatch(/^\d{12}$/);
			expect(item.number.slice(0, 3)).toBe(item.provinceCode);
		}
	});

	it("defaults to 10 people in Vietnamese and drops diacritics in English", async () => {
		const vi = await fakeData("", "203.0.113.2");
		expect(vi.body.type).toBe("person");
		expect(vi.body.items).toHaveLength(10);
		const en = await fakeData(
			"?type=address&locale=en&count=50",
			"203.0.113.2",
		);
		expect(en.status).toBe(200);
		for (const item of en.body.items) {
			expect(item.full).toMatch(/^[\x20-\x7e]+$/);
		}
	});

	it("refuses a count or type out of range with 400", async () => {
		for (const query of [
			"?count=0",
			"?count=51",
			"?type=passport",
			"?locale=fr",
			"?seed=-1",
			"?seed=4294967296",
			"?seed=1.5",
		]) {
			const res = await fakeData(query, "203.0.113.3");
			expect(res.status, query).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
		}
	});

	it("gives the same records for the same seed", async () => {
		const query = "?type=company&count=3&seed=4294967295";
		const first = await fakeData(query, "203.0.113.7");
		const again = await fakeData(query, "203.0.113.7");
		expect(first.status).toBe(200);
		expect(again.body.items).toEqual(first.body.items);
		const other = await fakeData("?type=company&count=3&seed=1", "203.0.113.7");
		expect(other.body.items).not.toEqual(first.body.items);
	});

	it("answers 429 past the limit per address, other addresses unaffected", async () => {
		for (let i = 0; i < FAKE_DATA_LIMIT_PER_MINUTE; i += 1) {
			expect(
				(await fakeData("?type=phone&count=1", "203.0.113.4")).status,
			).toBe(200);
		}
		const limited = await fakeData("?type=phone&count=1", "203.0.113.4");
		expect(limited.status).toBe(429);
		expect(limited.body.error.code).toBe("RATE_LIMITED");
		const retryAfter = Number(limited.headers["retry-after"]);
		expect(retryAfter).toBeGreaterThanOrEqual(1);
		expect(retryAfter).toBeLessThanOrEqual(60);
		expect(limited.body.error.details).toEqual({
			retryAfterSeconds: retryAfter,
		});
		expect((await fakeData("?type=phone", "203.0.113.5")).status).toBe(200);
	});

	it("runs in the tenant of its host and refuses a host of no tenant", async () => {
		const acme = await fakeData(
			"?type=company",
			"203.0.113.6",
			"localman.acme.example",
		);
		expect(acme.status).toBe(200);
		expect(acme.body.items).toHaveLength(10);
		const nobody = await fakeData("", "203.0.113.6", "localman.nope.example");
		expect(nobody.status).toBe(421);
	});

	it("is an MCP tool of the public toolset", () => {
		expect(toMcpToolDescriptor(generateFakeData)).toMatchObject({
			name: "generate_fake_data",
		});
	});
});
