import { type JWTPayload, type JWTVerifyGetKey, errors, jwtVerify } from "jose";

export const BACKCHANNEL_LOGOUT_EVENT =
	"http://schemas.openid.net/event/backchannel-logout";
/** The IdP signs every token with ES256. */
const ALGORITHMS = ["ES256"];
const MAX_TOKEN_AGE_SECONDS = 120;
const CLOCK_TOLERANCE_SECONDS = 30;

/** The token is not a valid logout token for this client (answer 400). */
export class InvalidLogoutTokenError extends Error {
	constructor(reason: string) {
		super(reason);
		this.name = "InvalidLogoutTokenError";
	}
}

export interface LogoutTarget {
	readonly sid: string;
	readonly sub: string | null;
}

export interface LogoutTokenCheck {
	readonly keys: JWTVerifyGetKey;
	readonly issuer: string;
	readonly clientId: string;
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value !== "";
}

/**
 * The JWKS could not be fetched or is not a key set: a failure of the IdP
 * or the network, not a bad token (answer 503 so the IdP may retry).
 */
function isJwksFailure(error: unknown): boolean {
	if (!(error instanceof errors.JOSEError)) return true;
	return (
		error instanceof errors.JWKSTimeout ||
		error instanceof errors.JWKSInvalid ||
		error.constructor === errors.JOSEError
	);
}

/**
 * OpenID Connect Back-Channel Logout 1.0, 2.6: signature against the IdP
 * JWKS, `iss`, `aud` = our client id, a recent `iat`, the back-channel
 * event, a `sid` (the client registers `backchannel_logout_session_required`)
 * and no `nonce`, so an ID token cannot pass for a logout token.
 */
export async function verifyLogoutToken(
	token: string,
	check: LogoutTokenCheck,
): Promise<LogoutTarget> {
	let payload: JWTPayload;
	try {
		({ payload } = await jwtVerify(token, check.keys, {
			issuer: check.issuer,
			audience: check.clientId,
			algorithms: ALGORITHMS,
			typ: "logout+jwt",
			maxTokenAge: MAX_TOKEN_AGE_SECONDS,
			clockTolerance: CLOCK_TOLERANCE_SECONDS,
			requiredClaims: ["iat", "jti"],
		}));
	} catch (error) {
		if (isJwksFailure(error)) throw error;
		const code = error instanceof errors.JOSEError ? error.code : "invalid";
		throw new InvalidLogoutTokenError(code);
	}
	const events = payload.events;
	if (
		typeof events !== "object" ||
		events === null ||
		Array.isArray(events) ||
		!(BACKCHANNEL_LOGOUT_EVENT in events)
	) {
		throw new InvalidLogoutTokenError("missing back-channel logout event");
	}
	if ("nonce" in payload) {
		throw new InvalidLogoutTokenError("a logout token has no nonce");
	}
	if (!nonEmptyString(payload.sid)) {
		throw new InvalidLogoutTokenError("missing sid");
	}
	if (payload.sub !== undefined && !nonEmptyString(payload.sub)) {
		throw new InvalidLogoutTokenError("sub must be a non-empty string");
	}
	return { sid: payload.sid, sub: payload.sub ?? null };
}
