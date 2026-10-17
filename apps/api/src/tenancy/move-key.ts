import { randomBytes } from "node:crypto";
import { CompactEncrypt, type JWK, compactDecrypt, importJWK } from "jose";
import type { Keyring } from "../modules/auth/token-cipher.js";

/**
 * The key a moving tenant's sealed values travel under (hoandat-auth ADR
 * 0007 §7): made for one move, sealed to the install's migration key
 * (ECDH-ES on P-256), so only that install opens the values, and the
 * shared server's own keyring never leaves it.
 */

const ALG = "ECDH-ES+A256KW";
const ENC = "A256GCM";
const CONTENT_TYPE = "localman-move-key+jwe";
const MOVE_KID = "move";

export interface MoveKey {
	readonly tenantId: string;
	readonly keyring: Keyring;
}

function keyringOf(key: Buffer): Keyring {
	return { activeKid: MOVE_KID, keys: new Map([[MOVE_KID, key]]) };
}

function ecP256(jwk: unknown, part: "public" | "private"): JWK {
	if (typeof jwk !== "object" || jwk === null) {
		throw new Error(`the migration key is not a ${part} key`);
	}
	const key = jwk as JWK;
	const isPrivate = typeof key.d === "string";
	if (
		key.kty !== "EC" ||
		key.crv !== "P-256" ||
		isPrivate !== (part === "private")
	) {
		throw new Error(`the migration key is not an EC P-256 ${part} key`);
	}
	return key;
}

/** A fresh move key for `tenantId`. */
export function createMoveKey(tenantId: string): MoveKey {
	return { tenantId, keyring: keyringOf(randomBytes(32)) };
}

/** The move key sealed to the install's migration public key (a JWK). */
export async function sealMoveKey(
	moveKey: MoveKey,
	installPublicJwk: unknown,
): Promise<string> {
	const publicKey = await importJWK(ecP256(installPublicJwk, "public"), ALG);
	const key = moveKey.keyring.keys.get(MOVE_KID);
	if (!key) throw new Error("the move key is missing");
	const payload = JSON.stringify({
		tenantId: moveKey.tenantId,
		key: key.toString("base64url"),
	});
	return new CompactEncrypt(new TextEncoder().encode(payload))
		.setProtectedHeader({ alg: ALG, enc: ENC, cty: CONTENT_TYPE })
		.encrypt(publicKey);
}

/** Opens a sealed move key with the install's migration private key. */
export async function openMoveKey(
	jwe: string,
	installPrivateJwk: unknown,
): Promise<MoveKey> {
	const privateKey = await importJWK(ecP256(installPrivateJwk, "private"), ALG);
	const { plaintext, protectedHeader } = await compactDecrypt(
		jwe.trim(),
		privateKey,
		{
			keyManagementAlgorithms: [ALG],
			contentEncryptionAlgorithms: [ENC],
		},
	);
	if (protectedHeader.cty !== CONTENT_TYPE) throw new Error("not a move key");
	const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
	if (typeof parsed !== "object" || parsed === null)
		throw new Error("not a move key");
	const { tenantId, key } = parsed as Record<string, unknown>;
	if (typeof tenantId !== "string" || typeof key !== "string") {
		throw new Error("not a move key");
	}
	const bytes = Buffer.from(key, "base64url");
	if (bytes.length !== 32) throw new Error("not a move key");
	return { tenantId, keyring: keyringOf(bytes) };
}
