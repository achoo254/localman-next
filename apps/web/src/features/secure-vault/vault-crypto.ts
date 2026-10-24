/**
 * The browser vault of local secret values: AES-GCM (WebCrypto) with a
 * key derived from the user's passphrase by PBKDF2-SHA256. The key never
 * leaves the browser; the server only stores `lmv1:` ciphertext. Each
 * value is bound to its variable (`aad`), so a ciphertext copied onto
 * another variable does not open.
 */

/** Prefix of every vault ciphertext (version 1). */
export const VAULT_PREFIX = "lmv1:";
/** OWASP's 2023 figure for PBKDF2-HMAC-SHA256. */
export const VAULT_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
/** Encrypted on vault creation; opening it proves the passphrase. */
const CHECK_TEXT = "localman-vault-check";
const CHECK_AAD = "vault-check";

export interface VaultParams {
	/** base64url. */
	readonly salt: string;
	readonly iterations: number;
	/** `lmv1:` ciphertext of a fixed text. */
	readonly check: string;
}

export class WrongPassphraseError extends Error {
	constructor() {
		super("Wrong passphrase");
		this.name = "WrongPassphraseError";
	}
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
	const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export const isVaultCiphertext = (value: string): boolean =>
	value.startsWith(VAULT_PREFIX);

/** A non-extractable AES-GCM key from the passphrase. */
export async function deriveVaultKey(
	passphrase: string,
	salt: string,
	iterations = VAULT_ITERATIONS,
): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey(
		"raw",
		encoder.encode(passphrase),
		"PBKDF2",
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{ name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(salt), iterations },
		material,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

/** `lmv1:` + base64url(iv ‖ ciphertext); a fresh IV every time. */
export async function sealValue(
	key: CryptoKey,
	plaintext: string,
	aad: string,
): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const sealed = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv, additionalData: encoder.encode(aad) },
			key,
			encoder.encode(plaintext),
		),
	);
	const out = new Uint8Array(iv.length + sealed.length);
	out.set(iv);
	out.set(sealed, iv.length);
	return VAULT_PREFIX + toBase64Url(out);
}

/** The plaintext; `WrongPassphraseError` when the key or `aad` do not match. */
export async function openValue(
	key: CryptoKey,
	ciphertext: string,
	aad: string,
): Promise<string> {
	if (!isVaultCiphertext(ciphertext)) throw new WrongPassphraseError();
	const bytes = fromBase64Url(ciphertext.slice(VAULT_PREFIX.length));
	try {
		const plain = await crypto.subtle.decrypt(
			{
				name: "AES-GCM",
				iv: bytes.slice(0, IV_BYTES),
				additionalData: encoder.encode(aad),
			},
			key,
			bytes.slice(IV_BYTES),
		);
		return decoder.decode(plain);
	} catch {
		throw new WrongPassphraseError();
	}
}

/** A new vault: its salt, and the check that proves the passphrase later. */
export async function createVault(
	passphrase: string,
): Promise<{ params: VaultParams; key: CryptoKey }> {
	const salt = toBase64Url(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
	const key = await deriveVaultKey(passphrase, salt);
	const check = await sealValue(key, CHECK_TEXT, CHECK_AAD);
	return { params: { salt, iterations: VAULT_ITERATIONS, check }, key };
}

/** The key, once the passphrase opens the check; `WrongPassphraseError` otherwise. */
export async function unlockVault(
	params: VaultParams,
	passphrase: string,
): Promise<CryptoKey> {
	const key = await deriveVaultKey(passphrase, params.salt, params.iterations);
	if ((await openValue(key, params.check, CHECK_AAD)) !== CHECK_TEXT) {
		throw new WrongPassphraseError();
	}
	return key;
}

/** What binds a local value to its variable: the scope and the name. */
export const valueAad = (scope: string, name: string): string =>
	`${scope}\u0000${name}`;
