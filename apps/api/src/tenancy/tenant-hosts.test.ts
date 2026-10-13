import request from "supertest";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createLogger } from "../logger.js";
import { createMockApp } from "../mock-server.js";
import { createSsrfGuard } from "../modules/api-client/ssrf-guard.js";
import { clearMockProjectCache } from "../modules/mock-runtime/resolve-project.js";
import { UsageMeter } from "../modules/mock-runtime/usage-meter.js";
import { ProjectModel } from "../modules/projects/project-model.js";
import { UserModel } from "../modules/users/user-model.js";
import {
	testApp,
	useDashboardTestDb,
} from "../test-support/dashboard-test-app.js";
import { TEST_TENANT } from "../test-support/test-tenant.js";
import { createIdpTenantDirectory } from "./idp-tenant-directory.js";
import { type LocalmanTenant, runInTenant } from "./tenant-context.js";
import { configureTenants, singleTenantDirectory } from "./tenant-directory.js";
import { tenantSettings } from "./tenant-settings.js";

const ACME: LocalmanTenant = {
	id: "ten_AAAAAAAAAAAAAAAA",
	domain: "acme.example",
	displayName: "Acme",
	issuer: "https://auth.acme.example",
	publicUrl: "https://localman.acme.example",
	mockBaseDomain: "localman.acme.example",
	ownerSubs: new Set(),
};
const OWNER = "acc_owner";
const logger = createLogger("silent");
const idp = {
	byHost: vi.fn(async (host: string) =>
		host === "localman.acme.example" ? ACME : undefined,
	),
	byId: vi.fn(async (id: string) => (id === ACME.id ? ACME : undefined)),
};
const mockApp = createMockApp({
	logger,
	usageMeter: new UsageMeter({ logger, warn: async () => undefined }),
	trustProxy: "loopback",
});

useDashboardTestDb(() => ({
	mockBaseDomain: "localman.test",
	publicUrl: "https://localman.test",
}));
beforeAll(() => {
	configureTenants(
		createIdpTenantDirectory({ primary: TEST_TENANT, client: idp, logger }),
	);
});
afterAll(() => configureTenants(singleTenantDirectory(TEST_TENANT)));
beforeEach(async () => {
	clearMockProjectCache();
	await UserModel.create({ sub: OWNER, username: "owner" });
	await runInTenant(ACME, () =>
		UserModel.create({ sub: OWNER, username: "owner" }),
	);
});

/** The dashboard API on `host` as `OWNER` (mutations from that origin). */
function dashboard(host: string) {
	const origin = `https://${host}`;
	return {
		get: (path: string) =>
			request(testApp)
				.get(`/api/v1${path}`)
				.set("host", host)
				.set("x-test-sub", OWNER),
		post: (path: string, body: object) =>
			request(testApp)
				.post(`/api/v1${path}`)
				.set("host", host)
				.set("origin", origin)
				.set("x-test-sub", OWNER)
				.send(body),
	};
}

async function projectWithUsers(
	host: string,
): Promise<{ id: string; secret: string }> {
	const created = await dashboard(host).post("/projects", { name: "Mock" });
	expect(created.status, JSON.stringify(created.body)).toBe(201);
	const users = await dashboard(host).post(
		`/projects/${created.body.id}/resources`,
		{
			name: "users",
		},
	);
	expect(users.status, JSON.stringify(users.body)).toBe(201);
	return { id: created.body.id, secret: created.body.secret };
}

describe("tenants by host", () => {
	it("keeps each tenant's projects to its own dashboard", async () => {
		await projectWithUsers("localman.test");
		const acme = await dashboard("localman.acme.example").get("/projects");
		expect(acme.status).toBe(200);
		expect(acme.body).toMatchObject({ items: [] });
		const primary = await dashboard("localman.test").get("/projects");
		expect(primary.body.items).toHaveLength(1);
	});

	it("serves a mock only on its own tenant's hosts, even with the same secret", async () => {
		const { secret } = await projectWithUsers("localman.test");
		const acme = await dashboard("localman.acme.example").post("/projects", {
			name: "Other",
		});
		await runInTenant(ACME, () =>
			ProjectModel.updateOne({ _id: acme.body.id }, { secret }).exec(),
		);
		const mock = (host: string) =>
			request(mockApp).get("/users").set("host", host);
		expect((await mock(`${secret}.localman.test`)).status).toBe(200);
		// Cached for the primary tenant: the other tenant still gets its own.
		expect((await mock(`${secret}.localman.acme.example`)).status).toBe(404);
		expect(
			(
				await request(mockApp)
					.get(`/m/${secret}/users`)
					.set("host", "localman.acme.example")
			).status,
		).toBe(404);
	});

	it("answers 421 on a host of no tenant, except /healthz", async () => {
		expect(
			(await dashboard("localman.nope.example").get("/projects")).status,
		).toBe(421);
		expect(
			(await request(mockApp).get("/healthz").set("host", "127.0.0.1")).status,
		).toBe(200);
	});

	it("keeps the primary and known tenants up while the IdP is down", async () => {
		await dashboard("localman.acme.example").get("/projects");
		idp.byHost
			.mockRejectedValueOnce(new Error("down"))
			.mockRejectedValueOnce(new Error("down"));
		expect((await dashboard("localman.test").get("/projects")).status).toBe(
			200,
		);
		expect(
			(await dashboard("localman.acme.example").get("/projects")).status,
		).toBe(200);
		expect(
			(await dashboard("localman.unseen.example").get("/projects")).status,
		).toBe(503);
	});

	it("lets the proxy reach only the calling tenant's mock hosts", async () => {
		const guard = createSsrfGuard({
			mockBaseDomain: () => tenantSettings().mockBaseDomain,
			tunnelDomains: () => tenantSettings().tunnelDomains,
			ownAddresses: () => ["93.184.216.34"],
			resolve: async () => [{ address: "93.184.216.34", family: 4 }],
		});
		const pin = (url: string) => guard.pin(new URL(url));
		await runInTenant(ACME, async () => {
			expect((await pin("https://abc.localman.acme.example/")).forceHost).toBe(
				true,
			);
			expect((await pin("https://x.tunnel.acme.example/")).forceHost).toBe(
				true,
			);
			await expect(pin("https://abc.localman.test/")).rejects.toMatchObject({
				code: "PROXY_TARGET_BLOCKED",
			});
		});
		expect((await pin("https://abc.localman.test/")).forceHost).toBe(true);
		await expect(
			pin("https://abc.localman.acme.example/"),
		).rejects.toMatchObject({
			code: "PROXY_TARGET_BLOCKED",
		});
	});
});
