import { type Configuration, errors } from "oidc-provider";

export const WEB_CLIENT_ID = "localman-web";

/** Localman API scopes: what a DCR client that registers no scope may ask. */
export const DCR_DEFAULT_SCOPES: readonly string[] = [
	"mock:read",
	"mock:write",
	"client:read",
	"client:write",
	"client:send",
];

/** Lets an agent mint credentials; a DCR client must register it by name. */
export const CREDENTIALS_SCOPE = "credentials:write";

/** Scopes the Localman MCP resource accepts, as auth.hoandat.com sets them. */
export const MCP_RESOURCE_SCOPES: readonly string[] = [
	...DCR_DEFAULT_SCOPES,
	CREDENTIALS_SCOPE,
];

/** Every scope the IdP supports: OIDC scopes plus the MCP resource scopes. */
export const SUPPORTED_SCOPES: readonly string[] = [
	"openid",
	"offline_access",
	"profile",
	"email",
	"telegram",
	...MCP_RESOURCE_SCOPES,
];

type ResourceIndicators = NonNullable<
	NonNullable<Configuration["features"]>["resourceIndicators"]
>;

/**
 * TEST ONLY. Resource indicators (RFC 8707) as auth.hoandat.com sets them
 * up: `localman-web` signs in without a resource (opaque access token, the
 * subject of the token exchange), and any other client (an MCP client
 * registered through DCR) gets ES256 JWT access tokens (`typ: at+jwt`)
 * whose `aud` is `{localman}/mcp`.
 */
export function mcpResourceIndicators(
	localmanPublicUrl: string,
): ResourceIndicators {
	const resource = `${localmanPublicUrl}/mcp`;
	const isWeb = (clientId: string | undefined) => clientId === WEB_CLIENT_ID;
	return {
		enabled: true,
		defaultResource: async (_ctx, client, oneOf) =>
			oneOf ?? (isWeb(client.clientId) ? undefined : resource),
		getResourceServerInfo: async (_ctx, indicator, client) => {
			if (isWeb(client.clientId) || indicator !== resource) {
				throw new errors.InvalidTarget(
					"resource is not allowed for this client",
				);
			}
			return {
				scope: MCP_RESOURCE_SCOPES.join(" "),
				audience: resource,
				accessTokenTTL: 900,
				accessTokenFormat: "jwt",
				jwt: { sign: { alg: "ES256" } },
			};
		},
		useGrantedResource: async (ctx) => !isWeb(ctx.oidc.client?.clientId),
	};
}
