export type { IdpTransport } from "@localman/tenancy";
import type { OidcClient } from "./oidc-client.js";

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
