import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FORMAT_VERSION = "v1";
const KID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export interface Keyring {
	/** Key id used for every new ciphertext (the first entry). */
	readonly activeKid: string;
	readonly keys: ReadonlyMap<string, Buffer>;
}

/**
 * Parses `kid:base64key[,kid:base64key…]`. The first key encrypts; the rest
 * only decrypt, so a key can be rotated without signing everyone out.
 * Returns `null` on any malformed entry; never echoes key material.
 */
export function parseKeyring(value: string): Keyring | null {
	const keys = new Map<string, Buffer>();
	let activeKid: string | undefined;
	for (const entry of value.split(",")) {
		const separator = entry.indexOf(":");
		if (separator <= 0) return null;
		const kid = entry.slice(0, separator).trim();
		const encoded = entry.slice(separator + 1).trim();
		if (!KID_PATTERN.test(kid) || keys.has(kid)) return null;
		if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(encoded)) return null;
		const key = Buffer.from(encoded, "base64");
		if (key.length !== KEY_BYTES) return null;
		keys.set(kid, key);
		activeKid ??= kid;
	}
	return activeKid ? { activeKid, keys } : null;
}

export class TokenCipherError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TokenCipherError";
	}
}

/**
 * AES-256-GCM for secrets at rest (session tokens). The associated data
 * binds a ciphertext to its owner record, so a blob copied into another
 * record fails to decrypt. Output: `v1.<kid>.<iv>.<ciphertext>.<tag>`.
 */
export class TokenCipher {
	constructor(private readonly keyring: Keyring) {}

	encrypt(plaintext: string, associatedData: string): string {
		const kid = this.keyring.activeKid;
		const key = this.keyring.keys.get(kid);
		if (!key) throw new TokenCipherError("active key is missing");
		const iv = randomBytes(IV_BYTES);
		const cipher = createCipheriv(ALGORITHM, key, iv, {
			authTagLength: TAG_BYTES,
		});
		cipher.setAAD(Buffer.from(associatedData, "utf8"));
		const ciphertext = Buffer.concat([
			cipher.update(plaintext, "utf8"),
			cipher.final(),
		]);
		return [
			FORMAT_VERSION,
			kid,
			iv.toString("base64url"),
			ciphertext.toString("base64url"),
			cipher.getAuthTag().toString("base64url"),
		].join(".");
	}

	decrypt(sealed: string, associatedData: string): string {
		const [version, kid, iv, ciphertext, tag] = sealed.split(".");
		if (
			version !== FORMAT_VERSION ||
			kid === undefined ||
			iv === undefined ||
			ciphertext === undefined ||
			tag === undefined
		) {
			throw new TokenCipherError("malformed ciphertext");
		}
		const key = this.keyring.keys.get(kid);
		if (!key) throw new TokenCipherError("unknown key id");
		try {
			const decipher = createDecipheriv(
				ALGORITHM,
				key,
				Buffer.from(iv, "base64url"),
				{ authTagLength: TAG_BYTES },
			);
			decipher.setAAD(Buffer.from(associatedData, "utf8"));
			decipher.setAuthTag(Buffer.from(tag, "base64url"));
			return Buffer.concat([
				decipher.update(Buffer.from(ciphertext, "base64url")),
				decipher.final(),
			]).toString("utf8");
		} catch {
			throw new TokenCipherError("ciphertext failed authentication");
		}
	}
}
