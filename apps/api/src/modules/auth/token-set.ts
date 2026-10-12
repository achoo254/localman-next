import type * as oidc from "openid-client";

/** Used when the token response omits `expires_in`; refreshes early. */
const FALLBACK_TOKEN_TTL_SECONDS = 60;

export interface TokenSet {
	readonly accessToken: string;
	readonly refreshToken?: string;
	readonly idToken?: string;
	readonly accessTokenExpiresAt: Date;
	/** Validated ID token claims, when the response carried an ID token. */
	readonly claims?: oidc.IDToken;
}

/** A token endpoint response as Localman stores and uses it. */
export function toTokenSet(
	response: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
): TokenSet {
	const ttl = response.expiresIn() ?? FALLBACK_TOKEN_TTL_SECONDS;
	return {
		accessToken: response.access_token,
		refreshToken: response.refresh_token,
		idToken: response.id_token,
		accessTokenExpiresAt: new Date(Date.now() + ttl * 1000),
		claims: response.claims(),
	};
}
