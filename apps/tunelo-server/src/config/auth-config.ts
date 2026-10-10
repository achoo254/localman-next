/**
 * Authentication settings, read from the environment at startup.
 *
 * - `AUTH_MODE=hybrid` (default): identity-provider JWTs and anonymous
 *   `tunelo_…` tokens are both accepted; anonymous ones only until
 *   `LEGACY_TOKEN_CUTOFF`.
 * - `AUTH_MODE=legacy`: rollback switch. The identity-provider branch is off
 *   and anonymous tokens work as before, with no cutoff.
 */
export type AuthMode = "legacy" | "hybrid";

export interface AuthConfig {
	readonly mode: AuthMode;
	/** `iss` of accepted JWTs; the JWKS is fetched from `${issuer}/jwks`. */
	readonly issuer: string;
	/** `aud` of accepted JWTs: this server's resource indicator. */
	readonly audience: string;
	/** Epoch ms from which anonymous tokens stop opening tunnels; `null` = no cutoff. */
	readonly legacyCutoffMs: number | null;
}

const DEFAULT_ISSUER = "https://auth.hoandat.com";
const DEFAULT_AUDIENCE = "https://tunnel.hoandat.com";

function parseUrl(name: string, value: string): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${name} must be an absolute URL`);
	}
	const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
	if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
		throw new Error(`${name} must use https (http only for localhost)`);
	}
	// Compared verbatim with the token's claims: no trailing slash.
	return value.replace(/\/+$/, "");
}

function parseMode(value: string | undefined): AuthMode {
	if (value === undefined || value === "") return "hybrid";
	if (value === "legacy" || value === "hybrid") return value;
	throw new Error("AUTH_MODE must be 'legacy' or 'hybrid'");
}

function parseCutoff(value: string | undefined): number | null {
	if (value === undefined || value.trim() === "") return null;
	const ms = Date.parse(value);
	if (Number.isNaN(ms)) {
		throw new Error("LEGACY_TOKEN_CUTOFF must be an ISO 8601 date");
	}
	return ms;
}

export function loadAuthConfig(
	env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
	return {
		mode: parseMode(env.AUTH_MODE),
		issuer: parseUrl("AUTH_ISSUER", env.AUTH_ISSUER || DEFAULT_ISSUER),
		audience: parseUrl("AUTH_AUDIENCE", env.AUTH_AUDIENCE || DEFAULT_AUDIENCE),
		legacyCutoffMs: parseCutoff(env.LEGACY_TOKEN_CUTOFF),
	};
}
