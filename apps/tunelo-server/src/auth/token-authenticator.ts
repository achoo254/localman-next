import { TUNNEL_SCOPES, type TunnelScope } from "@tunelo/shared";
import type { AuthConfig } from "../config/auth-config.js";
import type { KeyInfo, KeyStore } from "../key-store/key-store-types.js";
import { TUNELO_LOGIN_COMMAND } from "../tenancy/login-command.js";
import { type IdpTokenVerifier, looksLikeJwt } from "./idp-token-verifier.js";
import { hashToken } from "./token-hash.js";

const DEFAULT_MAX_TUNNELS = 3;

export type AuthErrorCode =
	| "TUNELO_AUTH_001"
	| "TUNELO_AUTH_003"
	| "TUNELO_AUTH_004";

export type AuthOutcome =
	| { ok: true; keyInfo: KeyInfo }
	| {
			ok: false;
			code: AuthErrorCode;
			message: string;
			/** Verification could not run (JWKS unreachable); try again later. */
			retryable: boolean;
	  };

export interface TokenAuthenticator {
	readonly config: AuthConfig;
	/**
	 * Resolves a bearer token (identity-provider JWT or `tunelo_…`) to its
	 * key info, enforcing `requiredScope` (`null`: any valid token) and the
	 * anonymous-token cutoff.
	 */
	authenticate(
		token: string,
		requiredScope: TunnelScope | null,
	): Promise<AuthOutcome>;
	/** ISO cutoff for anonymous tokens, when one applies. */
	legacyCutoffIso(): string | undefined;
}

export interface TokenAuthenticatorDeps {
	config: AuthConfig;
	keyStore: KeyStore;
	verifier: IdpTokenVerifier;
	/** Clock, swapped in tests. */
	now?: () => number;
}

function fail(
	code: AuthErrorCode,
	message: string,
	retryable = false,
): AuthOutcome {
	return { ok: false, code, message, retryable };
}

const INVALID = fail("TUNELO_AUTH_001", "Invalid or expired token");

/** What a server-minted token may do; anonymous tokens predate scopes. */
function allows(keyInfo: KeyInfo, scope: TunnelScope): boolean {
	if (keyInfo.kind === "legacy") return scope === TUNNEL_SCOPES.OPEN;
	return keyInfo.scopes.includes(scope);
}

export function createTokenAuthenticator(
	deps: TokenAuthenticatorDeps,
): TokenAuthenticator {
	const { config, keyStore, verifier } = deps;
	const now = deps.now ?? Date.now;
	// Rollback mode keeps anonymous tokens working with no cutoff.
	const cutoffMs = config.mode === "hybrid" ? config.legacyCutoffMs : null;

	function legacyCutoffIso(): string | undefined {
		return cutoffMs === null ? undefined : new Date(cutoffMs).toISOString();
	}

	async function fromIdp(
		token: string,
		requiredScope: TunnelScope | null,
	): Promise<AuthOutcome> {
		const result = await verifier.verify(token, requiredScope);
		if (!result.ok) {
			if (result.reason === "insufficient_scope") {
				return fail(
					"TUNELO_AUTH_003",
					`Token lacks the ${requiredScope} scope`,
				);
			}
			if (result.reason === "unavailable") {
				return fail(
					"TUNELO_AUTH_001",
					"Could not verify the token right now, try again",
					true,
				);
			}
			return INVALID;
		}
		const { sub, scopes, maxTunnels } = result.identity;
		return {
			ok: true,
			keyInfo: {
				kind: "idp",
				userId: sub,
				keyId: sub,
				keyHash: hashToken(token),
				maxTunnels: maxTunnels ?? DEFAULT_MAX_TUNNELS,
				plan: "free",
				role: "user",
				scopes,
				ownerSub: sub,
			},
		};
	}

	async function fromServerToken(
		token: string,
		requiredScope: TunnelScope | null,
	): Promise<AuthOutcome> {
		const keyInfo = await keyStore.validate(hashToken(token));
		if (!keyInfo) return INVALID;

		if (requiredScope && !allows(keyInfo, requiredScope)) {
			return fail(
				"TUNELO_AUTH_003",
				keyInfo.kind === "link"
					? "Link tokens can only list tunnels, not open them"
					: `Token lacks the ${requiredScope} scope`,
			);
		}
		if (keyInfo.kind === "legacy" && cutoffMs !== null && now() >= cutoffMs) {
			const day = new Date(cutoffMs).toISOString().slice(0, 10);
			return fail(
				"TUNELO_AUTH_004",
				`Anonymous tokens stopped working on ${day}. Run \`${TUNELO_LOGIN_COMMAND}\` to sign in with your account.`,
			);
		}
		return { ok: true, keyInfo };
	}

	return {
		config,
		legacyCutoffIso,
		authenticate(token, requiredScope) {
			if (looksLikeJwt(token)) {
				// Rollback mode: the identity-provider branch is switched off.
				if (config.mode === "legacy") return Promise.resolve(INVALID);
				return fromIdp(token, requiredScope);
			}
			return fromServerToken(token, requiredScope);
		},
	};
}

/** `Authorization: Bearer <token>` → token, or null. */
export function bearerTokenOf(header: string | undefined): string | null {
	const match = header?.match(/^Bearer\s+(\S+)$/i);
	const token = match?.[1];
	return token && token.length <= 8192 ? token : null;
}
