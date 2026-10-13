import type * as oidc from "openid-client";
import type { SessionTokens } from "./web-session-store.js";

/** Used when the token response omits `expires_in`; refreshes early. */
const FALLBACK_ACCESS_TTL_SECONDS = 60;
/** The IdP's grant idle window, when it does not state the refresh expiry. */
const REFRESH_IDLE_SECONDS = 30 * 24 * 60 * 60;

/** Tokens of one response, plus what the console reads from the ID token. */
export interface IssuedTokens extends SessionTokens {
	/** Only for userinfo right after sign-in; never stored. */
	readonly accessToken: string;
	readonly sub: string | null;
	readonly sid: string | null;
}

/** Longest display name or username kept; longer values are cut. */
const MAX_PROFILE_LENGTH = 200;

export function stringClaim(
	claims: Readonly<Record<string, unknown>> | undefined,
	name: string,
): string | null {
	const value = claims?.[name];
	return typeof value === "string" && value.trim() !== ""
		? value.trim().slice(0, MAX_PROFILE_LENGTH)
		: null;
}

export function toIssuedTokens(
	response: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
	now = Date.now(),
): IssuedTokens {
	const accessTtl = response.expiresIn() ?? FALLBACK_ACCESS_TTL_SECONDS;
	const stated = response.refresh_token_expires_in;
	const refreshTtl =
		typeof stated === "number" && stated > 0 ? stated : REFRESH_IDLE_SECONDS;
	const accessExp = new Date(now + accessTtl * 1000);
	const claims = response.claims();
	return {
		accessToken: response.access_token,
		refreshToken: response.refresh_token ?? null,
		idToken: response.id_token ?? null,
		accessExp,
		// Without a refresh token nothing can prove the grant after expiry.
		refreshExp: response.refresh_token
			? new Date(now + refreshTtl * 1000)
			: accessExp,
		sub: stringClaim(claims, "sub"),
		sid: stringClaim(claims, "sid"),
	};
}
