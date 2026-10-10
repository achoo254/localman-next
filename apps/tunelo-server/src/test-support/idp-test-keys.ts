import {
	type JWTVerifyGetKey,
	SignJWT,
	createLocalJWKSet,
	exportJWK,
	generateKeyPair,
} from "jose";

export const TEST_ISSUER = "https://auth.test.local";
export const TEST_AUDIENCE = "https://tunnel.hoandat.com";

export interface TestIdp {
	keys: JWTVerifyGetKey;
	jwks: { keys: Record<string, unknown>[] };
	/** Signs an access token; each option overrides one claim or header. */
	sign(options?: {
		sub?: string;
		scope?: string;
		audience?: string;
		issuer?: string;
		expiresIn?: string | number;
		typ?: string;
		claims?: Record<string, unknown>;
	}): Promise<string>;
}

/** A fake identity provider: one ES256 key, a local JWKS, a token signer. */
export async function createTestIdp(): Promise<TestIdp> {
	const { privateKey, publicKey } = await generateKeyPair("ES256");
	const jwk = {
		...(await exportJWK(publicKey)),
		kid: "test-key",
		alg: "ES256",
	};
	const jwks = { keys: [jwk] };
	return {
		keys: createLocalJWKSet(jwks),
		jwks,
		sign(options = {}) {
			return new SignJWT({
				scope: options.scope ?? "tunnels:open tunnels:read",
				client_id: "tunelo-cli",
				...options.claims,
			})
				.setProtectedHeader({
					alg: "ES256",
					kid: "test-key",
					typ: options.typ ?? "at+jwt",
				})
				.setSubject(options.sub ?? "acc_alice")
				.setIssuer(options.issuer ?? TEST_ISSUER)
				.setAudience(options.audience ?? TEST_AUDIENCE)
				.setIssuedAt()
				.setExpirationTime(options.expiresIn ?? "15m")
				.sign(privateKey);
		},
	};
}
