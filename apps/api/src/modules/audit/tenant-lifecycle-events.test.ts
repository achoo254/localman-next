import { randomUUID } from "node:crypto";
import { type JWK, SignJWT, exportJWK, generateKeyPair, importJWK } from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import {
	AUDIT_CREDENTIALS,
	type AuthHarness,
	PUBLIC_URL,
	startAuthHarness,
} from "../auth/testing/auth-harness.js";
import { AuditEventModel } from "./audit-event-model.js";
import { basic } from "./testing/security-events.js";

const AUDIENCE = `${PUBLIC_URL}/internal/audit-events`;
/** A tenant the IdP moved off: Localman serves no `localman.acme.example`. */
const TENANT_ISSUER = "https://auth.acme.example";
const OWNER = "google:109876543210";

let harness: AuthHarness;
let teardownMongo: () => Promise<void>;
/** The tenant's own signing key, which the IdP no longer publishes. */
let tenantKey: JWK;

beforeAll(async () => {
	teardownMongo = await connectTestMongo();
	harness = await startAuthHarness();
	const { privateKey } = await generateKeyPair("ES256", { extractable: true });
	tenantKey = { ...(await exportJWK(privateKey)), kid: "acme-key-1" };
});
afterAll(async () => {
	await harness?.close();
	await teardownMongo?.();
});
beforeEach(async () => {
	await clearCollections();
});

interface Overrides {
	readonly type?: string;
	readonly data?: Record<string, unknown>;
	readonly claims?: Record<string, unknown>;
	readonly issuedOffset?: number;
}

/**
 * Exactly what the IdP sends (hoandat-auth src/audit/security-event-token.ts
 * with the tenant's issuer and keys, src/tenants/migration-routes.ts and
 * enrollment-redeem.ts for the data): `toe`, one `events` member holding
 * `{ domain }`, `iss`/`aud`/`sub`/`jti`, `iat`, `exp` 10 minutes later.
 */
async function senderSet(type: string, overrides: Overrides = {}) {
	const signedAt =
		Math.floor(Date.now() / 1000) + (overrides.issuedOffset ?? 0);
	const jti = randomUUID();
	// `iss` and `aud` sit in the payload before `overrides.claims` so a test
	// can replace them; `setIssuer`/`setAudience` would overwrite the override.
	const token = await new SignJWT({
		iss: TENANT_ISSUER,
		aud: AUDIENCE,
		toe: signedAt - 5,
		events: {
			[`urn:hoandat:auth:event:${overrides.type ?? type}`]: overrides.data ?? {
				domain: "acme.example",
			},
		},
		...overrides.claims,
	})
		.setProtectedHeader({
			alg: "ES256",
			kid: tenantKey.kid,
			typ: "secevent+jwt",
		})
		.setSubject(OWNER)
		.setJti(jti)
		.setIssuedAt(signedAt)
		.setExpirationTime(signedAt + 600)
		.sign(await importJWK(tenantKey, "ES256"));
	return { token, jti };
}

function post(token: string, jti?: string, credentials = AUDIT_CREDENTIALS) {
	const call = request(harness.app)
		.post("/internal/audit-events")
		.set("authorization", basic(credentials.clientId, credentials.clientSecret))
		.set("content-type", "application/secevent+jwt");
	if (jti) call.set("idempotency-key", jti);
	return call.send(token);
}

describe("lifecycle events of a tenant no longer served here", () => {
	it.each(["tenant.migrating", "tenant.self_hosted"])(
		"records %s as the IdP sends it, once",
		async (type) => {
			const { token, jti } = await senderSet(type);
			const first = await post(token, jti);
			expect(first.status, JSON.stringify(first.body)).toBe(202);
			expect(first.body).toEqual({ status: "accepted" });
			const stored = await AuditEventModel.findById(jti).lean();
			expect(stored).toMatchObject({
				sub: OWNER,
				type,
				data: {
					domain: "acme.example",
					issuer: TENANT_ISSUER,
					signature: "not-verifiable",
				},
			});
			// The IdP retries until it gets a 2xx: a redelivery is acknowledged.
			const again = await post(token, jti);
			expect(again.status).toBe(202);
			expect(again.body).toEqual({ status: "duplicate" });
			expect(await AuditEventModel.countDocuments()).toBe(1);
		},
	);

	it("keeps the request origin the IdP may add", async () => {
		const { token } = await senderSet("tenant.migrating", {
			data: { domain: "acme.example", ip: "203.0.113.7", user_agent: "UA" },
		});
		expect((await post(token)).status).toBe(202);
	});

	it.each([
		[
			"another event type",
			{ type: "method.unlinked", data: { method: "telegram" } },
		],
		["another domain in the data", { data: { domain: "evil.example" } }],
		["extra data", { data: { domain: "acme.example", note: "x" } }],
		["missing data", { data: {} }],
		["another audience", { claims: { aud: "https://elsewhere.test/intake" } }],
		["an old token", { issuedOffset: -3600 }],
		["a token from the future", { issuedOffset: 3600 }],
		[
			"two events",
			{
				claims: {
					events: {
						"urn:hoandat:auth:event:tenant.migrating": {
							domain: "acme.example",
						},
						"urn:hoandat:auth:event:tenant.self_hosted": {
							domain: "acme.example",
						},
					},
				},
			},
		],
	] as const)("refuses %s with 400", async (_name, overrides) => {
		const { token } = await senderSet("tenant.migrating", overrides);
		const res = await post(token);
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("INVALID_SECURITY_EVENT");
		expect(await AuditEventModel.countDocuments()).toBe(0);
	});

	it("refuses an Idempotency-Key that is not the jti", async () => {
		const { token } = await senderSet("tenant.migrating");
		expect((await post(token, "another-id")).status).toBe(400);
	});

	it("still needs the IdP's Basic credentials", async () => {
		const { token } = await senderSet("tenant.migrating");
		const res = await post(token, undefined, {
			clientId: AUDIT_CREDENTIALS.clientId,
			clientSecret: "wrong",
		});
		expect(res.status).toBe(401);
		expect(await AuditEventModel.countDocuments()).toBe(0);
	});

	it("never takes an unverifiable event for the deployment's own issuer", async () => {
		const { token } = await senderSet("tenant.migrating", {
			claims: { iss: harness.issuer },
		});
		expect((await post(token)).status).toBe(400);
	});
});
