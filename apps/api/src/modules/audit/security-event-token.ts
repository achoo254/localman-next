import { type JWTVerifyGetKey, errors, jwtVerify } from "jose";

/** RFC 8417 media type of a Security Event Token. */
export const SET_MEDIA_TYPE = "application/secevent+jwt";
/** Event URIs of the IdP: `urn:hoandat:auth:event:` + type. */
const EVENT_URI_PREFIX = "urn:hoandat:auth:event:";
const CLOCK_TOLERANCE_SECONDS = 30;
/**
 * The IdP signs every delivery attempt afresh with a 10-minute `exp`, so a
 * genuine SET is minutes old at most. Anything older, or valid for longer
 * than this, is a replayed or forged token.
 */
const MAX_AGE_SECONDS = 15 * 60;

/** The SET is malformed, unsigned by the IdP or not for us (answer 400). */
export class InvalidSecurityEventError extends Error {
	constructor(reason: string) {
		super(reason);
		this.name = "InvalidSecurityEventError";
	}
}

export interface AuditEvent {
	readonly jti: string;
	readonly sub: string;
	/** Event type without the URI prefix, e.g. `method.linked`. */
	readonly type: string;
	/** When the event happened (`toe`), or the signing time. */
	readonly occurredAt: Date;
	readonly data: Readonly<Record<string, unknown>>;
}

export interface SecurityEventVerifier {
	readonly jwks: JWTVerifyGetKey;
	readonly issuer: string;
	/** The intake URL itself (the IdP's AUDIT_EVENTS_URL). */
	readonly audience: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Verifies a SET from the IdP: ES256 signature against its JWKS,
 * `typ: secevent+jwt`, `iss`, `aud` = our URL, `iat` at most 15 minutes
 * old and `exp` at most 15 minutes after it (each attempt is signed afresh
 * for 10 minutes), `jti`, `sub`, and exactly one IdP event.
 * Errors reaching the JWKS are rethrown as-is (a server-side failure).
 */
export async function verifySecurityEvent(
	token: string,
	verifier: SecurityEventVerifier,
): Promise<AuditEvent> {
	let payload: Record<string, unknown>;
	try {
		({ payload } = await jwtVerify(token, verifier.jwks, {
			issuer: verifier.issuer,
			audience: verifier.audience,
			algorithms: ["ES256"],
			typ: "secevent+jwt",
			clockTolerance: CLOCK_TOLERANCE_SECONDS,
			// Rejects an `iat` older than this or in the future.
			maxTokenAge: MAX_AGE_SECONDS,
			requiredClaims: ["iat", "exp", "jti", "sub"],
		}));
	} catch (error) {
		const fetchFailure =
			error instanceof errors.JWKSTimeout ||
			(error instanceof errors.JOSEError && error.code === "ERR_JOSE_GENERIC");
		if (error instanceof errors.JOSEError && !fetchFailure) {
			throw new InvalidSecurityEventError(error.code);
		}
		throw error;
	}
	const { jti, sub, events, toe, iat, exp } = payload;
	if (
		typeof iat !== "number" ||
		typeof exp !== "number" ||
		exp - iat > MAX_AGE_SECONDS
	) {
		throw new InvalidSecurityEventError("exp is too far from iat");
	}
	if (typeof jti !== "string" || jti === "" || jti.length > 200) {
		throw new InvalidSecurityEventError("invalid jti");
	}
	if (typeof sub !== "string" || sub === "") {
		throw new InvalidSecurityEventError("invalid sub");
	}
	const entries = isRecord(events) ? Object.entries(events) : [];
	const [entry] = entries;
	if (
		entries.length !== 1 ||
		!entry ||
		!entry[0].startsWith(EVENT_URI_PREFIX)
	) {
		throw new InvalidSecurityEventError("expected exactly one IdP event");
	}
	const [uri, data] = entry;
	if (!isRecord(data))
		throw new InvalidSecurityEventError("invalid event data");
	const seconds = typeof toe === "number" ? toe : iat;
	return {
		jti,
		sub,
		type: uri.slice(EVENT_URI_PREFIX.length),
		occurredAt: new Date(seconds * 1000),
		data,
	};
}
