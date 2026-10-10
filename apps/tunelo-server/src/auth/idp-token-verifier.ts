import { SERVER_TOKEN_PREFIX } from "@tunelo/shared";
import {
	type JWTPayload,
	type JWTVerifyGetKey,
	createRemoteJWKSet,
	errors,
	jwtVerify,
} from "jose";
import { createLogger } from "../logger.js";

const logger = createLogger("tunelo-idp-verifier");

/** The identity-provider signs access tokens with ES256 only. */
const ALGORITHMS = ["ES256"];
/** RFC 9068 access-token type; rejects ID tokens and logout tokens. */
const ACCESS_TOKEN_TYP = "at+jwt";
const JWKS_TIMEOUT_MS = 5_000;
/** Upper bound on the optional per-account tunnel quota claim. */
const MAX_TUNNELS_CEILING = 100;

export interface IdpIdentity {
	/** Stable account id (`acc_…`). */
	sub: string;
	scopes: string[];
	/** OAuth client that obtained the token (`tunelo-cli`, `localman-web`…). */
	clientId: string | null;
	/** Per-account tunnel quota from the `max_tunnels` claim, when present. */
	maxTunnels: number | null;
}

export type IdpVerifyResult =
	| { ok: true; identity: IdpIdentity }
	| { ok: false; reason: "invalid" | "insufficient_scope" | "unavailable" };

export interface IdpTokenVerifier {
	verify(token: string, requiredScope: string | null): Promise<IdpVerifyResult>;
}

export interface IdpTokenVerifierOptions {
	issuer: string;
	audience: string;
	/** Key source; defaults to the issuer's remote JWKS (cached by jose). */
	keys?: JWTVerifyGetKey;
}

/** Cheap shape check: three base64url segments and not a server token. */
export function looksLikeJwt(token: string): boolean {
	if (token.startsWith(SERVER_TOKEN_PREFIX)) return false;
	return /^[\w-]+\.[\w-]+\.[\w-]+$/.test(token);
}

function scopesOf(payload: JWTPayload): string[] {
	return typeof payload.scope === "string"
		? payload.scope.split(" ").filter((s) => s.length > 0)
		: [];
}

function maxTunnelsOf(payload: JWTPayload): number | null {
	const value = payload.max_tunnels;
	if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
		return null;
	}
	return Math.min(value, MAX_TUNNELS_CEILING);
}

/**
 * Trouble reaching the JWKS, as opposed to a bad token: a timeout, a network
 * error, or a bare `JOSEError` (jose's error for a non-200 JWKS response;
 * token problems are always a subclass).
 */
function isUnavailable(err: unknown): boolean {
	if (err instanceof errors.JWKSTimeout) return true;
	if (!(err instanceof errors.JOSEError)) return true;
	return err.constructor === errors.JOSEError;
}

export function createIdpTokenVerifier(
	options: IdpTokenVerifierOptions,
): IdpTokenVerifier {
	const keys =
		options.keys ??
		createRemoteJWKSet(new URL(`${options.issuer}/jwks`), {
			timeoutDuration: JWKS_TIMEOUT_MS,
		});

	return {
		async verify(token, requiredScope) {
			let payload: JWTPayload;
			try {
				({ payload } = await jwtVerify(token, keys, {
					issuer: options.issuer,
					audience: options.audience,
					algorithms: ALGORITHMS,
					typ: ACCESS_TOKEN_TYP,
					requiredClaims: ["exp", "sub"],
				}));
			} catch (err) {
				if (isUnavailable(err)) {
					// Never log the token itself.
					logger.warn({ err }, "JWKS unavailable, token not verified");
					return { ok: false, reason: "unavailable" };
				}
				return { ok: false, reason: "invalid" };
			}

			if (typeof payload.sub !== "string" || payload.sub.length === 0) {
				return { ok: false, reason: "invalid" };
			}
			const scopes = scopesOf(payload);
			if (requiredScope && !scopes.includes(requiredScope)) {
				return { ok: false, reason: "insufficient_scope" };
			}
			const clientId =
				typeof payload.client_id === "string" ? payload.client_id : null;
			return {
				ok: true,
				identity: {
					sub: payload.sub,
					scopes,
					clientId,
					maxTunnels: maxTunnelsOf(payload),
				},
			};
		},
	};
}
