import { type JWTVerifyGetKey, errors, jwtVerify } from "jose";
import { isJwksFetchError } from "../auth/logout-token.js";

/** The IdP signs access tokens with ES256 only (integration guide §3). */
const ACCESS_TOKEN_ALGORITHMS = ["ES256"];
const CLOCK_TOLERANCE_SECONDS = 30;
const MAX_SUBJECT_LENGTH = 255;
const MAX_CLIENT_ID_LENGTH = 255;

/** Where the IdP's identity and signing keys come from (the OIDC client). */
export interface AccessTokenKeys {
	issuer(): Promise<string>;
	jwks(): Promise<JWTVerifyGetKey>;
}

/** A verified IdP access token issued for the Localman MCP resource. */
export interface McpAccessToken {
	readonly subject: string;
	/** OAuth client the user granted (a dynamically registered MCP client). */
	readonly clientId: string;
	readonly scopes: readonly string[];
	/** Seconds since the epoch. */
	readonly expiresAt: number;
}

/** The token is not acceptable here (answer 401 `invalid_token`). */
export class InvalidAccessTokenError extends Error {
	constructor(reason: string) {
		super(reason);
		this.name = "InvalidAccessTokenError";
	}
}

function boundedString(value: unknown, max: number): string | null {
	return typeof value === "string" && value !== "" && value.length <= max
		? value
		: null;
}

/** `scope` is a space-separated list (RFC 9068 §2.2.3); absent is none. */
function scopesOf(value: unknown): string[] {
	if (value === undefined) return [];
	if (typeof value !== "string") {
		throw new InvalidAccessTokenError("scope must be a string");
	}
	return value.split(" ").filter((scope) => scope !== "");
}

/**
 * Verifies a JWT access token (RFC 9068) offline against the IdP's JWKS:
 * signature with an allowed algorithm, `typ: at+jwt` (so an ID or logout
 * token cannot pass), `iss`, `aud` containing `audience`, `exp` and `sub`.
 * Errors reaching the IdP or its JWKS are rethrown as they are (503).
 */
export async function verifyMcpAccessToken(
	token: string,
	keys: AccessTokenKeys,
	audience: string,
): Promise<McpAccessToken> {
	const [issuer, jwks] = await Promise.all([keys.issuer(), keys.jwks()]);
	let payload: Record<string, unknown>;
	try {
		({ payload } = await jwtVerify(token, jwks, {
			issuer,
			audience,
			algorithms: ACCESS_TOKEN_ALGORITHMS,
			typ: "at+jwt",
			clockTolerance: CLOCK_TOLERANCE_SECONDS,
			requiredClaims: ["sub", "exp"],
		}));
	} catch (error) {
		if (error instanceof errors.JOSEError && !isJwksFetchError(error)) {
			throw new InvalidAccessTokenError(error.code);
		}
		throw error;
	}
	const subject = boundedString(payload.sub, MAX_SUBJECT_LENGTH);
	if (!subject) throw new InvalidAccessTokenError("invalid sub");
	const clientId = boundedString(payload.client_id, MAX_CLIENT_ID_LENGTH);
	if (!clientId) throw new InvalidAccessTokenError("invalid client_id");
	const expiresAt = payload.exp;
	if (typeof expiresAt !== "number") {
		throw new InvalidAccessTokenError("invalid exp");
	}
	return { subject, clientId, scopes: scopesOf(payload.scope), expiresAt };
}
