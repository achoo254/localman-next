import * as oidc from "openid-client";
import { z } from "zod";
import type { TokenCipher } from "./token-cipher.js";
import { AUTH_TRANSACTION_TTL_MS } from "./web-cookies.js";

/** Associated data of the sealed sign-in cookie: it opens nowhere else. */
const PURPOSE = "tunelo_auth";

const transactionSchema = z.object({
	state: z.string().min(16).max(256),
	nonce: z.string().min(16).max(256),
	codeVerifier: z.string().min(43).max(128),
	/** Epoch ms after which the callback is refused. */
	exp: z.number().int(),
});

export type AuthTransaction = z.output<typeof transactionSchema>;

/**
 * One sign-in in progress. It lives only in the browser's `__Host-` cookie,
 * sealed with AES-256-GCM (so it is both secret and tamper-proof), which
 * binds the callback to the browser that started the sign-in.
 */
export function newAuthTransaction(now = Date.now()): AuthTransaction {
	return {
		state: oidc.randomState(),
		nonce: oidc.randomNonce(),
		codeVerifier: oidc.randomPKCECodeVerifier(),
		exp: now + AUTH_TRANSACTION_TTL_MS,
	};
}

export function sealAuthTransaction(
	cipher: TokenCipher,
	transaction: AuthTransaction,
): string {
	return cipher.seal(JSON.stringify(transaction), PURPOSE);
}

/** The transaction of a cookie, or `null` when absent, forged or expired. */
export function openAuthTransaction(
	cipher: TokenCipher,
	cookieValue: string | undefined,
	now = Date.now(),
): AuthTransaction | null {
	if (!cookieValue || cookieValue.length > 2048) return null;
	const plaintext = cipher.open(cookieValue, PURPOSE);
	if (plaintext === null) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(plaintext);
	} catch {
		return null;
	}
	const result = transactionSchema.safeParse(parsed);
	if (!result.success || result.data.exp <= now) return null;
	return result.data;
}
