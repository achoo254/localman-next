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
import { createLogger } from "../../logger.js";
import { createIdpTenantDirectory } from "../../tenancy/idp-tenant-directory.js";
import {
	type LocalmanTenant,
	runInTenant,
} from "../../tenancy/tenant-context.js";
import {
	configureTenants,
	singleTenantDirectory,
} from "../../tenancy/tenant-directory.js";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import { AuditEventModel } from "../audit/audit-event-model.js";
import { basic, signSecurityEvent } from "../audit/testing/security-events.js";
import { UserModel } from "../users/user-model.js";
import { AUDIT_CREDENTIALS, PUBLIC_URL } from "./testing/auth-harness.js";
import {
	type TenantAuthHarness,
	startTenantAuthHarness,
} from "./testing/tenant-auth-harness.js";
import { tunnelResource } from "./token-exchange.js";

const ACME: LocalmanTenant = {
	id: "ten_AAAAAAAAAAAAAAAA",
	domain: "acme.example",
	displayName: "Acme",
	issuer: "https://auth.acme.example",
	publicUrl: "https://localman.acme.example",
	mockBaseDomain: "localman.acme.example",
	ownerSubs: new Set(),
};
const ACME_HOST = "localman.acme.example";
let harness: TenantAuthHarness;
let teardownMongo: () => Promise<void>;

beforeAll(async () => {
	teardownMongo = await connectTestMongo();
	const client = {
		byHost: vi.fn(async (host: string) =>
			host === ACME_HOST ? ACME : undefined,
		),
		byId: vi.fn(async (id: string) => (id === ACME.id ? ACME : undefined)),
	};
	configureTenants(
		createIdpTenantDirectory({
			primary: TEST_TENANT,
			client,
			logger: createLogger("silent"),
		}),
	);
	harness = await startTenantAuthHarness(ACME, {
		sub: "acc_acme_1",
		username: "ada",
		email: "ada@acme.example",
		name: "Ada",
		telegram: { chatId: "777", username: "ada_tg" },
	});
});
afterAll(async () => {
	configureTenants(singleTenantDirectory(TEST_TENANT));
	await harness?.close();
	await teardownMongo?.();
});
beforeEach(() => clearCollections());

describe("signing in on another tenant's domain", () => {
	it("signs in with that tenant's IdP and keeps the user in that tenant", async () => {
		const { cookie } = await harness.signIn();
		const me = await request(harness.app)
			.get("/api/v1/users/me")
			.set("host", ACME_HOST)
			.set("cookie", cookie);
		expect(me.status, JSON.stringify(me.body)).toBe(200);
		const inAcme = await runInTenant(ACME, () =>
			UserModel.findOne({ sub: "acc_acme_1" }).lean().exec(),
		);
		expect(inAcme?.username).toBe("ada");
		const inPrimary = await runInTenant(TEST_TENANT, () =>
			UserModel.countDocuments({ sub: "acc_acme_1" }).exec(),
		);
		expect(inPrimary).toBe(0);
		// The session cookie means nothing on another tenant's host.
		const elsewhere = await request(harness.app)
			.get("/api/v1/users/me")
			.set("host", "localman.test")
			.set("cookie", cookie);
		expect(elsewhere.status).toBe(401);
	});

	it("applies an audit event at the shared intake in the tenant of its issuer", async () => {
		await harness.signIn();
		const token = await signSecurityEvent({
			issuer: ACME.issuer,
			audience: `${PUBLIC_URL}/internal/audit-events`,
			sub: "acc_acme_1",
			key: harness.idp.signingKey,
			foreignKey: harness.idp.signingKey,
		});
		const posted = await request(harness.app)
			.post("/internal/audit-events")
			.set("host", "localman.test")
			.set(
				"authorization",
				basic(AUDIT_CREDENTIALS.clientId, AUDIT_CREDENTIALS.clientSecret),
			)
			.set("content-type", "application/secevent+jwt")
			.send(token);
		expect(posted.status, JSON.stringify(posted.body)).toBe(202);
		const user = await runInTenant(ACME, () =>
			UserModel.findOne({ sub: "acc_acme_1" }).lean().exec(),
		);
		expect(user?.telegram ?? null).toBeNull();
		expect(
			await runInTenant(ACME, () => AuditEventModel.countDocuments().exec()),
		).toBe(1);
		expect(
			await runInTenant(TEST_TENANT, () =>
				AuditEventModel.countDocuments().exec(),
			),
		).toBe(0);
	});

	it("exchanges tokens for that tenant's Tunelo", () => {
		expect(runInTenant(ACME, () => tunnelResource())).toBe(
			"https://tunnel.acme.example",
		);
		expect(runInTenant(TEST_TENANT, () => tunnelResource())).toBe(
			"https://tunnel.hoandat.com",
		);
	});
});
