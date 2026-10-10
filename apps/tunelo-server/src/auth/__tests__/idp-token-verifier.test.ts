import http from "node:http";
import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
	TEST_AUDIENCE,
	TEST_ISSUER,
	type TestIdp,
	createTestIdp,
} from "../../test-support/idp-test-keys.js";
import {
	type IdpTokenVerifier,
	createIdpTokenVerifier,
	looksLikeJwt,
} from "../idp-token-verifier.js";

let idp: TestIdp;
let verifier: IdpTokenVerifier;

beforeAll(async () => {
	idp = await createTestIdp();
	verifier = createIdpTokenVerifier({
		issuer: TEST_ISSUER,
		audience: TEST_AUDIENCE,
		keys: idp.keys,
	});
});

describe("idp token verifier", () => {
	test("accepts a valid token and returns sub, scopes and client", async () => {
		const result = await verifier.verify(await idp.sign(), "tunnels:open");
		expect(result).toEqual({
			ok: true,
			identity: {
				sub: "acc_alice",
				scopes: ["tunnels:open", "tunnels:read"],
				clientId: "tunelo-cli",
				maxTunnels: null,
			},
		});
	});

	test("rejects a token for another audience", async () => {
		const token = await idp.sign({ audience: "https://localman.hoandat.com" });
		expect(await verifier.verify(token, null)).toEqual({
			ok: false,
			reason: "invalid",
		});
	});

	test("rejects an expired token", async () => {
		const token = await idp.sign({
			expiresIn: Math.floor(Date.now() / 1000) - 60,
		});
		expect(await verifier.verify(token, null)).toMatchObject({ ok: false });
	});

	test("rejects a token missing the required scope", async () => {
		const token = await idp.sign({ scope: "tunnels:read" });
		expect(await verifier.verify(token, "tunnels:open")).toEqual({
			ok: false,
			reason: "insufficient_scope",
		});
	});

	test("rejects another issuer and a non access-token typ", async () => {
		const otherIssuer = await idp.sign({ issuer: "https://evil.example" });
		const idToken = await idp.sign({ typ: "JWT" });
		expect((await verifier.verify(otherIssuer, null)).ok).toBe(false);
		expect((await verifier.verify(idToken, null)).ok).toBe(false);
	});

	test("rejects an HS256 token even with a matching key id", async () => {
		const token = await new SignJWT({ scope: "tunnels:open" })
			.setProtectedHeader({ alg: "HS256", kid: "test-key", typ: "at+jwt" })
			.setSubject("acc_alice")
			.setIssuer(TEST_ISSUER)
			.setAudience(TEST_AUDIENCE)
			.setExpirationTime("5m")
			.sign(new TextEncoder().encode("x".repeat(32)));
		expect((await verifier.verify(token, null)).ok).toBe(false);
	});

	test("reads a bounded max_tunnels claim", async () => {
		const token = await idp.sign({ claims: { max_tunnels: 7 } });
		const result = await verifier.verify(token, null);
		expect(result.ok && result.identity.maxTunnels).toBe(7);
	});

	test("tells server tokens and JWTs apart", async () => {
		expect(looksLikeJwt(await idp.sign())).toBe(true);
		expect(looksLikeJwt(`tunelo_${"a".repeat(48)}`)).toBe(false);
		expect(looksLikeJwt("not a token")).toBe(false);
	});
});

describe("idp token verifier with the remote JWKS", () => {
	let server: http.Server;
	let issuer: string;

	beforeAll(async () => {
		server = http.createServer((req, res) => {
			if (req.url === "/broken/jwks") {
				res.writeHead(500).end();
				return;
			}
			if (req.url !== "/jwks") {
				res.writeHead(404).end();
				return;
			}
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify(idp.jwks));
		});
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		const address = server.address();
		const port = typeof address === "object" && address ? address.port : 0;
		issuer = `http://127.0.0.1:${port}`;
	});

	afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

	test("fetches keys from <issuer>/jwks", async () => {
		const remote = createIdpTokenVerifier({ issuer, audience: TEST_AUDIENCE });
		const token = await idp.sign({ issuer });
		expect((await remote.verify(token, "tunnels:open")).ok).toBe(true);
	});

	test("reports a failing JWKS endpoint as unavailable", async () => {
		const broken = `${issuer}/broken`;
		const remote = createIdpTokenVerifier({
			issuer: broken,
			audience: TEST_AUDIENCE,
		});
		const token = await idp.sign({ issuer: broken });
		expect(await remote.verify(token, null)).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});

	test("reports an unreachable JWKS as unavailable, not invalid", async () => {
		const remote = createIdpTokenVerifier({
			issuer: "http://127.0.0.1:1",
			audience: TEST_AUDIENCE,
		});
		const token = await idp.sign({ issuer: "http://127.0.0.1:1" });
		expect(await remote.verify(token, null)).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});
});
