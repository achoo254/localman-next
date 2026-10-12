import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FORMAT_VERSION = "v1";

/** What a derived key is for; each purpose gets an independent key. */
export type KeyPurpose = "cipher" | "csrf";

/** HKDF-SHA256 sub-key of `WEB_SESSION_KEY`, so no key serves two uses. */
export function deriveKey(master: Buffer, purpose: KeyPurpose): Buffer {
	return Buffer.from(
		hkdfSync("sha256", master, "", `tunelo-web ${purpose}`, KEY_BYTES),
	);
}

/**
 * AES-256-GCM for secrets at rest (refresh tokens) and for the short-lived
 * sign-in cookie. The associated data binds a ciphertext to its use (the
 * session id, or the cookie name), so a blob copied elsewhere fails to open.
 * Output: `v1.<iv>.<ciphertext>.<tag>`, all base64url.
 */
export class TokenCipher {
	private readonly key: Buffer;

	constructor(master: Buffer) {
		if (master.length !== KEY_BYTES) {
			throw new Error("TokenCipher needs a 32-byte key");
		}
		this.key = deriveKey(master, "cipher");
	}

	seal(plaintext: string, associatedData: string): string {
		const iv = randomBytes(IV_BYTES);
		const cipher = createCipheriv(ALGORITHM, this.key, iv, {
			authTagLength: TAG_BYTES,
		});
		cipher.setAAD(Buffer.from(associatedData, "utf8"));
		const ciphertext = Buffer.concat([
			cipher.update(plaintext, "utf8"),
			cipher.final(),
		]);
		return [
			FORMAT_VERSION,
			iv.toString("base64url"),
			ciphertext.toString("base64url"),
			cipher.getAuthTag().toString("base64url"),
		].join(".");
	}

	/** The plaintext, or `null` when the blob is malformed or was altered. */
	open(sealed: string, associatedData: string): string | null {
		const [version, iv, ciphertext, tag, extra] = sealed.split(".");
		if (
			version !== FORMAT_VERSION ||
			iv === undefined ||
			ciphertext === undefined ||
			tag === undefined ||
			extra !== undefined
		) {
			return null;
		}
		try {
			const decipher = createDecipheriv(
				ALGORITHM,
				this.key,
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
			return null;
		}
	}
}
