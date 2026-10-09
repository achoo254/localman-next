import { type JWTVerifyGetKey, errors, jwtVerify } from "jose";
import mongoose, { Schema } from "mongoose";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";

export const BACKCHANNEL_LOGOUT_EVENT =
	"http://schemas.openid.net/event/backchannel-logout";
/** The IdP signs every token with ES256 (integration guide, section 3). */
const LOGOUT_TOKEN_ALGORITHMS = ["ES256"];
const MAX_TOKEN_AGE_SECONDS = 120;
const CLOCK_TOLERANCE_SECONDS = 30;

/** Seen `jti` values, kept past the token's acceptance window. */
const logoutTokenJtiSchema = new Schema(
	{
		_id: { type: String, required: true },
		expiresAt: { type: Date, required: true, expires: 0 },
	},
	{ collection: "logout_token_jtis", versionKey: false },
);
const LogoutTokenJtiModel = mongoose.model(
	"LogoutTokenJti",
	logoutTokenJtiSchema,
);

/** The token is not a valid logout token for this client (answer 400). */
export class InvalidLogoutTokenError extends Error {
	constructor(reason: string) {
		super(reason);
		this.name = "InvalidLogoutTokenError";
	}
}

export interface LogoutTarget {
	readonly jti: string;
	readonly sid?: string;
	readonly sub?: string;
}

export interface LogoutTokenVerifier {
	readonly jwks: JWTVerifyGetKey;
	readonly issuer: string;
	readonly clientId: string;
}

function optionalString(value: unknown, name: string): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || value === "") {
		throw new InvalidLogoutTokenError(`${name} must be a non-empty string`);
	}
	return value;
}

/**
 * OpenID Connect Back-Channel Logout 1.0 §2.6: signature (JWKS), `iss`,
 * `aud` = our client id, `typ`, a recent `iat`, the back-channel event,
 * `sid` or `sub`, a `jti`, and no `nonce` (so an ID token cannot pass).
 * Errors reaching the JWKS are rethrown as-is (a server-side failure).
 */
export async function verifyLogoutToken(
	token: string,
	verifier: LogoutTokenVerifier,
): Promise<LogoutTarget> {
	let payload: Record<string, unknown>;
	try {
		({ payload } = await jwtVerify(token, verifier.jwks, {
			issuer: verifier.issuer,
			audience: verifier.clientId,
			algorithms: LOGOUT_TOKEN_ALGORITHMS,
			typ: "logout+jwt",
			maxTokenAge: MAX_TOKEN_AGE_SECONDS,
			clockTolerance: CLOCK_TOLERANCE_SECONDS,
			requiredClaims: ["iat", "jti"],
		}));
	} catch (error) {
		if (error instanceof errors.JOSEError && !isJwksFetchError(error)) {
			throw new InvalidLogoutTokenError(error.code);
		}
		throw error;
	}
	const events = payload.events;
	if (
		typeof events !== "object" ||
		events === null ||
		!(BACKCHANNEL_LOGOUT_EVENT in events)
	) {
		throw new InvalidLogoutTokenError("missing back-channel logout event");
	}
	if ("nonce" in payload) {
		throw new InvalidLogoutTokenError("a logout token has no nonce");
	}
	const jti = optionalString(payload.jti, "jti");
	const sid = optionalString(payload.sid, "sid");
	const sub = optionalString(payload.sub, "sub");
	if (!jti) throw new InvalidLogoutTokenError("missing jti");
	if (!sid && !sub) throw new InvalidLogoutTokenError("missing sid and sub");
	return { jti, sid, sub };
}

/**
 * The JWKS could not be fetched or is not a valid key set: a failure of
 * the IdP or the network, not a bad token (answer 503, not 401).
 */
export function isJwksFetchError(error: errors.JOSEError): boolean {
	return (
		error instanceof errors.JWKSTimeout ||
		error instanceof errors.JWKSInvalid ||
		error.code === "ERR_JOSE_GENERIC"
	);
}

/** Records a `jti`; `false` when it was already used (a replay). */
export async function rememberLogoutTokenJti(
	issuer: string,
	jti: string,
): Promise<boolean> {
	const keepMs = (MAX_TOKEN_AGE_SECONDS + 2 * CLOCK_TOLERANCE_SECONDS) * 1000;
	try {
		await LogoutTokenJtiModel.create({
			_id: `${issuer} ${jti}`,
			expiresAt: new Date(Date.now() + keepMs),
		});
		return true;
	} catch (error) {
		if (isDuplicateKeyError(error)) return false;
		throw error;
	}
}
