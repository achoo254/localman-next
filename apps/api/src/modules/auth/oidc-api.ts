import type { JWTVerifyGetKey } from "jose";
import type * as oidc from "openid-client";
import type { OidcClient } from "./oidc-client.js";

/**
 * Reaching an IdP without its public DNS (another tenant's domain): its
 * discovery document and keys from the IdP's internal API, its endpoints
 * through `fetch`.
 */
export interface IdpTransport {
	metadata(): Promise<oidc.ServerMetadata>;
	readonly jwks: JWTVerifyGetKey;
	readonly fetch: oidc.CustomFetch;
}

/** What the routes, refresher and MCP use of a client (one or per tenant). */
export type OidcApi = Pick<
	OidcClient,
	| "redirectUri"
	| "postLogoutRedirectUri"
	| "clientId"
	| "issuer"
	| "jwks"
	| "authorizationUrl"
	| "exchangeCode"
	| "refresh"
	| "userInfo"
	| "exchangeToken"
	| "endSessionUrl"
>;
