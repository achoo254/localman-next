import {
	type JWK,
	type JWTPayload,
	SignJWT,
	createLocalJWKSet,
	exportJWK,
	generateKeyPair,
} from "jose";
import type { AccessTokenKeys } from "../mcp-access-token.js";

export const TEST_ISSUER = "https://auth.localman.test";
export const TEST_PUBLIC_URL = "https://localman.test";
export const TEST_RESOURCE = `${TEST_PUBLIC_URL}/mcp`;
export const TEST_CLIENT_ID = "mcp-client-1";

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

export interface TestTokenOptions {
	readonly sub?: string;
	readonly scope?: string;
	readonly issuer?: string;
	readonly audience?: string | string[];
	/** Seconds from now; negative for an expired token. */
	readonly expiresIn?: number;
	readonly typ?: string;
	readonly clientId?: string;
	/** Sign with the key outside the JWKS. */
	readonly untrustedKey?: boolean;
	/** Sign with the RS256 key that is in the JWKS but not allowed. */
	readonly rs256?: boolean;
}

export interface TestIdp {
	readonly keys: AccessTokenKeys;
	sign(options?: TestTokenOptions): Promise<string>;
}

async function publicJwk(key: CryptoKey, kid: string, alg: string) {
	const jwk: JWK = await exportJWK(key);
	return { ...jwk, kid, alg, use: "sig" };
}

/**
 * TEST ONLY. Signs IdP-style JWT access tokens (RFC 9068, ES256,
 * `typ: at+jwt`) and serves the matching JWKS, as auth.hoandat.com does
 * for the Localman MCP resource.
 */
export async function createTestIdp(): Promise<TestIdp> {
	const es256 = await generateKeyPair("ES256", { extractable: true });
	const rs256 = await generateKeyPair("RS256", { extractable: true });
	const untrusted = await generateKeyPair("ES256");
	const jwks = createLocalJWKSet({
		keys: [
			await publicJwk(es256.publicKey, "es-1", "ES256"),
			await publicJwk(rs256.publicKey, "rs-1", "RS256"),
		],
	});
	const pick = (options: TestTokenOptions): [SigningKey, string, string] => {
		if (options.rs256) return [rs256.privateKey, "RS256", "rs-1"];
		if (options.untrustedKey) return [untrusted.privateKey, "ES256", "es-1"];
		return [es256.privateKey, "ES256", "es-1"];
	};
	return {
		keys: { issuer: async () => TEST_ISSUER, jwks: async () => jwks },
		sign: async (options = {}) => {
			const [key, alg, kid] = pick(options);
			const now = Math.floor(Date.now() / 1000);
			const payload: JWTPayload = {
				client_id: options.clientId ?? TEST_CLIENT_ID,
				scope: options.scope ?? "mock:read mock:write",
			};
			return new SignJWT(payload)
				.setProtectedHeader({ alg, kid, typ: options.typ ?? "at+jwt" })
				.setIssuer(options.issuer ?? TEST_ISSUER)
				.setAudience(options.audience ?? TEST_RESOURCE)
				.setSubject(options.sub ?? "acc_mcp_user")
				.setIssuedAt(now)
				.setExpirationTime(now + (options.expiresIn ?? 900))
				.setJti(crypto.randomUUID())
				.sign(key);
		},
	};
}
