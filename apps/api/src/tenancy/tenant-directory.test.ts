import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseApp } from "../http/create-base-app.js";
import { createLogger } from "../logger.js";
import { TEST_TENANT } from "../test-support/test-tenant.js";
import { currentTenantId } from "./tenant-context.js";
import type { LocalmanTenant } from "./tenant-context.js";
import {
	configureTenants,
	primaryTenantDirectory,
} from "./tenant-directory.js";

/** The primary tenant as production builds it from the environment. */
const PRIMARY: LocalmanTenant = Object.freeze({
	...TEST_TENANT,
	domain: "hoandat.com",
	issuer: "https://auth.hoandat.com",
	publicUrl: "https://localman.hoandat.com",
	mockBaseDomain: "localman.hoandat.com",
});

const PRODUCTION = { tunnelDomains: ["tunnel.hoandat.com"], loopback: false };

/** Hosts nothing of this deployment answers on. */
const FOREIGN = [
	"evil.example",
	"1.2.3.4",
	"1.2.3.4:4000",
	"localman.acme.example",
	"abc.localman.acme.example",
	"tunnel.acme.example",
	"localman.hoandat.com.evil.example",
	"evillocalman.hoandat.com",
	"hoandat.com",
	"auth.hoandat.com",
	"",
];

describe("primaryTenantDirectory", () => {
	const directory = primaryTenantDirectory(PRIMARY, PRODUCTION);

	it("serves the dashboard, mock and tunnel hosts, any case and port", async () => {
		for (const host of [
			"localman.hoandat.com",
			"LOCALMAN.hoandat.com",
			"localman.hoandat.com:443",
			"s3cr3t.localman.hoandat.com",
			"tunnel.hoandat.com",
			"app.tunnel.hoandat.com",
		]) {
			expect(await directory.byHost(host), host).toBe(PRIMARY);
		}
	});

	it("refuses every other host", async () => {
		for (const host of FOREIGN) {
			expect(await directory.byHost(host), host).toBeUndefined();
		}
	});

	it("serves loopback hosts only when told to (never in production)", async () => {
		const loopback = ["localhost:5173", "127.0.0.1:4000", "[::1]:4000"];
		for (const host of loopback) {
			expect(await directory.byHost(host), host).toBeUndefined();
		}
		const dev = primaryTenantDirectory(PRIMARY, {
			...PRODUCTION,
			loopback: true,
		});
		for (const host of [...loopback, "abc.localhost:4100"]) {
			expect(await dev.byHost(host), host).toBe(PRIMARY);
		}
		expect(await dev.byHost("evil.example")).toBeUndefined();
		expect(await dev.byHost("1.2.3.4")).toBeUndefined();
	});

	it("knows only the primary tenant by id", async () => {
		expect(directory.primary).toBe(PRIMARY);
		expect(await directory.byId("primary")).toBe(PRIMARY);
		expect(await directory.byId("ten_AAAAAAAAAAAAAAAA")).toBeUndefined();
	});
});

describe("tenant scope of both servers in production", () => {
	const app = createBaseApp({
		logger: createLogger("silent"),
		mountRoutes: (base) =>
			base.get("/probe", (_req, res) => {
				res.json({ tenantId: currentTenantId() });
			}),
	});
	beforeAll(() =>
		configureTenants(primaryTenantDirectory(PRIMARY, PRODUCTION)),
	);
	afterAll(() =>
		configureTenants(
			primaryTenantDirectory(TEST_TENANT, {
				tunnelDomains: [],
				loopback: true,
			}),
		),
	);
	const probe = (host: string, path = "/probe") =>
		request(app).get(path).set("host", host);

	it("runs the primary tenant's hosts in the primary tenant", async () => {
		for (const host of [
			"localman.hoandat.com",
			"s3cr3t.localman.hoandat.com",
			"app.tunnel.hoandat.com",
		]) {
			const res = await probe(host);
			expect(res.status, host).toBe(200);
			expect(res.body).toEqual({ tenantId: "primary" });
		}
	});

	it("answers 421 to any other host", async () => {
		for (const host of ["evil.example", "1.2.3.4", "127.0.0.1:4000"]) {
			const res = await probe(host);
			expect(res.status, host).toBe(421);
			expect(res.body.error.code).toBe("MISDIRECTED_REQUEST");
		}
	});

	it("still answers the loopback health probe", async () => {
		const res = await probe("127.0.0.1:4000", "/healthz");
		expect(res.status).toBe(200);
		expect(res.body.status).toBe("ok");
	});
});
