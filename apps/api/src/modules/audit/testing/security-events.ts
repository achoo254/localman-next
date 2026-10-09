import { randomUUID } from "node:crypto";
import { type JWK, type JWTPayload, SignJWT, importJWK } from "jose";

export interface SetOptions {
	readonly type?: string;
	readonly data?: Record<string, unknown>;
	readonly claims?: JWTPayload;
	readonly typ?: string;
	/** Sign with a key the IdP never published. */
	readonly foreignKey?: boolean;
	readonly expiresIn?: number;
	/** Shifts `iat` (and `exp` with it) by this many seconds. */
	readonly issuedOffset?: number;
}

export interface SetSigner {
	readonly issuer: string;
	readonly audience: string;
	readonly sub: string;
	readonly key: JWK;
	readonly foreignKey: JWK;
}

/**
 * TEST ONLY. A Security Event Token shaped like the IdP's
 * (hoandat-auth src/audit/security-event-token.ts), with knobs to break it.
 */
export async function signSecurityEvent(
	signer: SetSigner,
	options: SetOptions = {},
): Promise<string> {
	const key = options.foreignKey ? signer.foreignKey : signer.key;
	const now = Math.floor(Date.now() / 1000) + (options.issuedOffset ?? 0);
	const claims: JWTPayload = {
		iss: signer.issuer,
		aud: signer.audience,
		sub: signer.sub,
		jti: randomUUID(),
		iat: now,
		exp: now + (options.expiresIn ?? 600),
		toe: now,
		events: {
			[`urn:hoandat:auth:event:${options.type ?? "method.unlinked"}`]:
				options.data ?? { method: "telegram" },
		},
		...options.claims,
	};
	return new SignJWT(claims)
		.setProtectedHeader({
			alg: "ES256",
			kid: key.kid,
			typ: options.typ ?? "secevent+jwt",
		})
		.sign(await importJWK(key, "ES256"));
}

/** `Authorization` header value for HTTP Basic. */
export function basic(id: string, secret: string): string {
	return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}
