import { type JWK, exportJWK, generateKeyPair } from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDashboardApp } from "../../dashboard-server.js";
import { createLogger } from "../../logger.js";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import { createAuthModule } from "../auth/auth-module.js";
import { SessionModel } from "../auth/session-model.js";
import {
	AUDIT_CREDENTIALS,
	type AuthHarness,
	PUBLIC_URL,
	startAuthHarness,
} from "../auth/testing/auth-harness.js";
import { UserModel } from "../users/user-model.js";
import { AuditEventModel } from "./audit-event-model.js";
import {
	type SetOptions,
	basic,
	signSecurityEvent,
} from "./testing/security-events.js";

const AUDIENCE = `${PUBLIC_URL}/internal/audit-events`;
const SUB = "acc_test_1";
let harness: AuthHarness;
let teardownMongo: () => Promise<void>;
let foreignKey: JWK;
let cookie: string;

beforeAll(async () => {
	teardownMongo = await connectTestMongo();
	harness = await startAuthHarness();
	const { privateKey } = await generateKeyPair("ES256", { extractable: true });
	foreignKey = { ...(await exportJWK(privateKey)), kid: "fake-idp-key" };
});
afterAll(async () => {
	await harness?.close();
	await teardownMongo?.();
});
beforeEach(async () => {
	await clearCollections();
	harness.account.telegram = { chatId: "424242", username: "dat_tg" };
	({ cookie } = await harness.signIn());
});

function securityEvent(options: SetOptions = {}): Promise<string> {
	return signSecurityEvent(
		{
			issuer: harness.issuer,
			audience: AUDIENCE,
			sub: SUB,
			key: harness.idp.signingKey,
			foreignKey,
		},
		options,
	);
}

function post(token: string, headers: Record<string, string> = {}) {
	// Server-to-server from the IdP: no Origin, no cookie.
	return request(harness.app)
		.post("/internal/audit-events")
		.set(
			"authorization",
			basic(AUDIT_CREDENTIALS.clientId, AUDIT_CREDENTIALS.clientSecret),
		)
		.set("content-type", "application/secevent+jwt")
		.set(headers)
		.send(token);
}

async function telegramOfUser() {
	return (await UserModel.findOne({ sub: SUB }).lean())?.telegram;
}

describe("POST /internal/audit-events", () => {
	it("forgets the Telegram chat when it is unlinked at the IdP", async () => {
		const res = await post(await securityEvent());
		expect(res.status).toBe(202);
		expect(res.headers["cache-control"]).toBe("no-store");
		expect((await telegramOfUser())?.chatId).toBeUndefined();
		expect(
			await AuditEventModel.countDocuments({ type: "method.unlinked" }),
		).toBe(1);
	});

	it("pauses Telegram after a relink until userinfo is read again", async () => {
		expect(
			(await post(await securityEvent({ type: "method.linked" }))).status,
		).toBe(202);
		expect((await telegramOfUser())?.refreshPendingAt).toBeInstanceOf(Date);

		// The next token refresh re-reads userinfo and resumes Telegram.
		harness.account.telegram = { chatId: "555", username: "new_tg" };
		await SessionModel.updateOne({}, { accessTokenExpiresAt: new Date(0) });
		const me = await request(harness.app)
			.get("/api/v1/users/me")
			.set("cookie", cookie);
		expect(me.body.telegram).toEqual({ linked: true, username: "new_tg" });
		const telegram = await telegramOfUser();
		expect(telegram?.chatId).toBe("555");
		expect(telegram?.refreshPendingAt).toBeUndefined();
	});

	it("records other events without acting on them", async () => {
		const token = await securityEvent({
			type: "login.succeeded",
			data: { methods: ["pwd"] },
		});
		expect((await post(token)).status).toBe(202);
		expect((await telegramOfUser())?.chatId).toBe("424242");
	});

	it("acknowledges a redelivered jti without applying it again", async () => {
		const token = await securityEvent();
		expect((await post(token)).status).toBe(202);
		await UserModel.updateOne({ sub: SUB }, { "telegram.chatId": "relinked" });
		const again = await post(token);
		expect(again.status).toBe(202);
		expect(again.body).toEqual({ status: "duplicate" });
		expect((await telegramOfUser())?.chatId).toBe("relinked");
	});

	it.each([
		["no credentials", ""],
		["a wrong secret", basic(AUDIT_CREDENTIALS.clientId, "wrong")],
		["a wrong id", basic("other", AUDIT_CREDENTIALS.clientSecret)],
	])("answers 401 to %s", async (_name, authorization) => {
		const res = await post(await securityEvent(), { authorization });
		expect(res.status).toBe(401);
		expect(res.headers["www-authenticate"]).toMatch(/^Basic/);
		expect((await telegramOfUser())?.chatId).toBe("424242");
	});

	it.each<[string, SetOptions]>([
		["a wrong audience", { claims: { aud: "https://localman.test/other" } }],
		["a wrong issuer", { claims: { iss: "https://evil.example" } }],
		["a JWT typ", { typ: "JWT" }],
		["an unknown key", { foreignKey: true }],
		["an expired token", { expiresIn: -600 }],
		// Signed 20 minutes ago but still "valid": too old to be a delivery.
		["an iat older than 15 minutes", { issuedOffset: -1200, expiresIn: 1500 }],
		["an iat in the future", { issuedOffset: 600 }],
		["an exp far after iat", { expiresIn: 24 * 60 * 60 }],
		[
			"a foreign event URI",
			{ type: "x", claims: { events: { "urn:other": {} } } },
		],
	])("answers 400 to a SET with %s", async (_name, options) => {
		const res = await post(await securityEvent(options));
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("INVALID_SECURITY_EVENT");
		expect((await telegramOfUser())?.chatId).toBe("424242");
	});

	it("rejects a mismatched Idempotency-Key and a wrong media type", async () => {
		const token = await securityEvent();
		expect((await post(token, { "idempotency-key": "other" })).status).toBe(
			400,
		);
		expect((await post(token, { "content-type": "text/plain" })).status).toBe(
			415,
		);
		expect((await telegramOfUser())?.chatId).toBe("424242");
	});

	it("answers 404 when audit credentials are not configured", async () => {
		const logger = createLogger("silent");
		const auth = createAuthModule(
			{
				issuer: harness.issuer,
				clientId: "localman-web",
				clientSecret: "s",
				publicUrl: PUBLIC_URL,
				sessionEncryptionKey: `k1:${Buffer.alloc(32, 4).toString("base64")}`,
			},
			logger,
		);
		const app = createDashboardApp({
			logger,
			allowedOrigins: [PUBLIC_URL],
			auth,
		});
		const res = await request(app)
			.post("/internal/audit-events")
			.set("content-type", "application/secevent+jwt")
			.send(await securityEvent());
		expect(res.status).toBe(404);
	});
});
