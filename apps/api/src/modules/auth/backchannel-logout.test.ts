import { randomUUID } from "node:crypto";
import {
	type JWK,
	type JWTPayload,
	SignJWT,
	exportJWK,
	generateKeyPair,
	importJWK,
} from "jose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import { BACKCHANNEL_LOGOUT_EVENT } from "./logout-token.js";
import { SessionModel } from "./session-model.js";
import { type AuthHarness, startAuthHarness } from "./testing/auth-harness.js";

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
});

interface TokenOptions {
	readonly payload?: JWTPayload;
	readonly omit?: readonly string[];
	readonly typ?: string;
	/** Sign with a key the IdP never published (same kid). */
	readonly foreignKey?: boolean;
	readonly iatOffsetSeconds?: number;
}

async function logoutToken(options: TokenOptions = {}): Promise<string> {
	const session = await SessionModel.findOne().lean();
	const claims: JWTPayload = {
		iss: harness.issuer,
		aud: "localman-web",
		iat: Math.floor(Date.now() / 1000) + (options.iatOffsetSeconds ?? 0),
		jti: randomUUID(),
		sub: session?.sub,
		sid: session?.sid ?? undefined,
		events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
		...options.payload,
	};
	for (const name of options.omit ?? []) delete claims[name];
	const key = options.foreignKey ? foreignKey : harness.idp.signingKey;
	return new SignJWT(claims)
		.setProtectedHeader({
			alg: "ES256",
			kid: key.kid,
			typ: options.typ ?? "logout+jwt",
		})
		.sign(await importJWK(key, "ES256"));
}

function postLogoutToken(token: string) {
	// Server-to-server from the IdP: no Origin header, no cookie.
	return request(harness.app)
		.post("/auth/backchannel-logout")
		.type("form")
		.send({ logout_token: token });
}

describe("POST /auth/backchannel-logout", () => {
	it("ends the sessions of the logged-out IdP session (sid)", async () => {
		const { cookie } = await harness.signIn();
		const res = await postLogoutToken(await logoutToken());
		expect(res.status).toBe(200);
		expect(res.headers["cache-control"]).toBe("no-store");
		expect(await SessionModel.countDocuments()).toBe(0);
		const me = await request(harness.app)
			.get("/api/v1/users/me")
			.set("cookie", cookie);
		expect(me.status).toBe(401);
	});

	it("ends every session of the subject when the token has no sid", async () => {
		await harness.signIn();
		await harness.signIn();
		expect(await SessionModel.countDocuments()).toBe(2);
		const res = await postLogoutToken(await logoutToken({ omit: ["sid"] }));
		expect(res.status).toBe(200);
		expect(await SessionModel.countDocuments()).toBe(0);
	});

	it("accepts a replayed jti as a no-op", async () => {
		await harness.signIn();
		const token = await logoutToken({ payload: { sid: "other-idp-session" } });
		expect((await postLogoutToken(token)).status).toBe(200);
		expect((await postLogoutToken(token)).status).toBe(200);
		expect(await SessionModel.countDocuments()).toBe(1);
	});

	it.each<[string, TokenOptions]>([
		["a wrong audience", { payload: { aud: "tunelo-web" } }],
		["a wrong issuer", { payload: { iss: "https://evil.example" } }],
		["a nonce (an ID token)", { payload: { nonce: "n-0S6_WzA2Mj" } }],
		["no back-channel event", { payload: { events: { other: {} } } }],
		["no sid and no sub", { omit: ["sid", "sub"] }],
		["no jti", { omit: ["jti"] }],
		["an old iat", { iatOffsetSeconds: -600 }],
		["the ID token typ", { typ: "JWT" }],
		["a key the IdP never published", { foreignKey: true }],
	])(
		"rejects a token with %s with 400 and keeps the session",
		async (_name, options) => {
			await harness.signIn();
			const res = await postLogoutToken(await logoutToken(options));
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("INVALID_LOGOUT_TOKEN");
			expect(await SessionModel.countDocuments()).toBe(1);
		},
	);

	it("rejects a missing token or a JSON body", async () => {
		const empty = await request(harness.app)
			.post("/auth/backchannel-logout")
			.type("form")
			.send({});
		expect(empty.status).toBe(400);
		await harness.signIn();
		const json = await request(harness.app)
			.post("/auth/backchannel-logout")
			.send({ logout_token: await logoutToken() });
		expect(json.status).toBe(400);
		expect(await SessionModel.countDocuments()).toBe(1);
		const garbage = await postLogoutToken("not.a.jwt");
		expect(garbage.status).toBe(400);
	});
});
