/**
 * Session of the iOS/Android shell: the opaque token `POST /auth/mobile/token`
 * returned (docs/decisions/0005-mobile-session-handoff.md), kept in the
 * Keychain / Android Keystore and sent as `Authorization: Bearer`. The web
 * build never sets it, so it keeps using its same-origin session cookie.
 */

/** Key of the token in the secure store. */
const TOKEN_KEY = "localman.session";

let token: string | null = null;

async function secureStorage() {
	const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
	return SecureStorage;
}

/** Reads the stored token once, before the first render. */
export async function loadMobileSession(): Promise<void> {
	const storage = await secureStorage();
	const value: unknown = await storage.get(TOKEN_KEY);
	token = typeof value === "string" && value !== "" ? value : null;
}

/** Token for the `Authorization` header; null when signed out (or on the web). */
export function mobileSessionToken(): string | null {
	return token;
}

export async function saveMobileSession(value: string): Promise<void> {
	const storage = await secureStorage();
	await storage.set(TOKEN_KEY, value);
	token = value;
}

export async function forgetMobileSession(): Promise<void> {
	token = null;
	const storage = await secureStorage();
	await storage.remove(TOKEN_KEY);
}

/** Headers that authenticate a request of the shell; empty without a session. */
export function mobileAuthHeaders(): Record<string, string> {
	return token === null ? {} : { Authorization: `Bearer ${token}` };
}
