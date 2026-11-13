import { type JWK, exportJWK, generateKeyPair } from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import {
	type SetOptions,
	signSecurityEvent,
} from "../audit/testing/security-events.js";
import { SessionModel } from "../auth/session-model.js";
import {
	type AuthHarness,
	PUBLIC_URL,
	startAuthHarness,
} from "../auth/testing/auth-harness.js";
import { UserModel } from "../users/user-model.js";
import { wasAccountDeleted } from "./deleted-account-model.js";

const AUDIENCE = `${PUBLIC_URL}/internal/account-deleted`;
let harness: AuthHarness;
let teardownMongo: () => Promise<void>;
let foreignKey: JWK;

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
	await harness.signIn();
});

function accountDeleted(
	options: SetOptions = {},
	sub = harness.account.sub,
): Promise<string> {
	return signSecurityEvent(
		{
			issuer: harness.issuer,
			audience: AUDIENCE,
			sub,
			key: harness.idp.signingKey,
			foreignKey,
		},
		{ type: "account.deleted", data: {}, ...options },
	);
}

/** Server-to-server from the IdP: no Basic, no Origin, no cookie. */
function post(token: string, contentType = "application/secevent+jwt") {
	return request(harness.app)
		.post("/internal/account-deleted")
		.set("content-type", contentType)
		.send(token);
}

async function accountExists(): Promise<boolean> {
	return (await UserModel.exists({ sub: harness.account.sub })) !== null;
}

describe("POST /internal/account-deleted", () => {
	it("deletes the account's Localman data at once, without Basic credentials", async () => {
		expect(await SessionModel.countDocuments()).toBe(1);
		const res = await post(await accountDeleted());
		expect(res.status, JSON.stringify(res.body)).toBe(202);
		expect(res.body).toEqual({ status: "deleted" });
		expect(res.headers["cache-control"]).toBe("no-store");
		expect(await accountExists()).toBe(false);
		expect(await SessionModel.countDocuments()).toBe(0);
		expect(await wasAccountDeleted(harness.account.sub)).toBe(true);
	});

	it("acknowledges a redelivery and a subject Localman never knew", async () => {
		const token = await accountDeleted();
		expect((await post(token)).status).toBe(202);
		const again = await post(token);
		expect(again.status).toBe(202);
		expect(again.body).toEqual({ status: "unknown" });
		const stranger = await post(await accountDeleted({}, "acc_never_seen"));
		expect(stranger.status).toBe(202);
		expect(stranger.body).toEqual({ status: "unknown" });
	});

	it.each<[string, SetOptions]>([
		["a key the IdP never published", { foreignKey: true }],
		["another audience", { claims: { aud: `${PUBLIC_URL}/elsewhere` } }],
		["an audience list", { claims: { aud: [AUDIENCE, "https://x.test"] } }],
		["another issuer", { claims: { iss: "https://idp.evil.test" } }],
		["an expired token", { issuedOffset: -3600 }],
		["another token type", { typ: "JWT" }],
	])("answers 401 to %s and deletes nothing", async (_, options) => {
		const res = await post(await accountDeleted(options));
		expect(res.status).toBe(401);
		expect(res.body.error.code).toBe("UNAUTHENTICATED");
		expect(await accountExists()).toBe(true);
	});

	it("answers 400 to a body that is not an account.deleted SET", async () => {
		const otherEvent = await accountDeleted({ type: "method.unlinked" });
		for (const res of [
			await post(otherEvent),
			await post("not-a-jwt"),
			await post(""),
			await post(await accountDeleted(), "text/plain"),
		]) {
			expect(res.status, JSON.stringify(res.body)).toBe(400);
			expect(res.body.error.code).toBe("INVALID_SECURITY_EVENT");
		}
		expect(await accountExists()).toBe(true);
	});
});
