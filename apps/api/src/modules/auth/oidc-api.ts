import type { OidcClient } from "./oidc-client.js";

/** What the routes, refresher and MCP use of the client. */
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
