/**
 * Session of the iOS/Android shell: the opaque token `POST /auth/mobile/token`
 * returned (docs/decisions/0005-mobile-session-handoff.md), kept in the
 * Keychain / Android Keystore and sent as `Authorization: Bearer`. The web
 * build never sets it, so it keeps using its same-origin session cookie.
 */

import type { SecureStorage as SecureStorageType } from "@aparajita/capacitor-secure-storage";

/** Key of the token in the secure store. */
const TOKEN_KEY = "localman.session";

let token: string | null = null;

type SecureStore = typeof SecureStorageType;

/**
 * Runs `use` on the secure store. The store is a Capacitor plugin proxy, which
 * answers every property, `then` included, with a native call: returned from
 * an async function it would be taken for a promise and its `then()` throws
 * ("not implemented"), so it never leaves this function.
 */
async function withSecureStorage<T>(
	use: (storage: SecureStore) => Promise<T>,
): Promise<T> {
	const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
	return use(SecureStorage);
}

/** Reads the stored token once, before the first render. */
export async function loadMobileSession(): Promise<void> {
	const value: unknown = await withSecureStorage((storage) =>
		storage.get(TOKEN_KEY),
	);
	token = typeof value === "string" && value !== "" ? value : null;
}

/** Token for the `Authorization` header; null when signed out (or on the web). */
export function mobileSessionToken(): string | null {
	return token;
}

export async function saveMobileSession(value: string): Promise<void> {
	await withSecureStorage((storage) => storage.set(TOKEN_KEY, value));
	token = value;
}

export async function forgetMobileSession(): Promise<void> {
	token = null;
	await withSecureStorage((storage) => storage.remove(TOKEN_KEY));
}

/** Headers that authenticate a request of the shell; empty without a session. */
export function mobileAuthHeaders(): Record<string, string> {
	return token === null ? {} : { Authorization: `Bearer ${token}` };
}
