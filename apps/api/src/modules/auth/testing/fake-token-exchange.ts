import { type KoaContextWithOIDC, errors } from "oidc-provider";
import { TUNNEL_RESOURCE, TUNNEL_SCOPE } from "../token-exchange.js";

export const TOKEN_EXCHANGE_GRANT =
	"urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

/**
 * RFC 8693 exchange as the real IdP implements it (src/oidc/token-exchange.ts
 * of hoandat-auth): an opaque access token of the caller with a live grant
 * buys a `tunnels:read` JWT for Tunelo; anything else is `invalid_request`.
 */
export async function exchangeToken(ctx: KoaContextWithOIDC): Promise<void> {
	const { params, client, provider } = ctx.oidc;
	if (!params || !client) throw new errors.InvalidRequest("missing client");
	if (params.subject_token_type !== ACCESS_TOKEN_TYPE) {
		throw new errors.InvalidRequest("unsupported subject_token_type");
	}
	if (params.resource !== TUNNEL_RESOURCE) {
		throw new errors.InvalidTarget("only Tunelo is a valid target");
	}
	const invalid = new errors.InvalidRequest("subject_token is invalid");
	const value = params.subject_token;
	if (typeof value !== "string" || value.split(".").length === 3) throw invalid;
	const subject = await provider.AccessToken.find(value);
	if (!subject || subject.clientId !== client.clientId) throw invalid;
	const grant = subject.grantId
		? await provider.Grant.find(subject.grantId)
		: undefined;
	if (!grant) throw invalid;
	const token = new provider.AccessToken({
		client,
		accountId: subject.accountId,
		grantId: subject.grantId,
		gty: "token_exchange",
		scope: TUNNEL_SCOPE,
		resourceServer: new provider.ResourceServer(TUNNEL_RESOURCE, {
			scope: TUNNEL_SCOPE,
			audience: TUNNEL_RESOURCE,
			accessTokenTTL: 900,
			accessTokenFormat: "jwt",
			jwt: { sign: { alg: "ES256" } },
		}),
	});
	ctx.body = {
		access_token: await token.save(),
		issued_token_type: ACCESS_TOKEN_TYPE,
		token_type: "Bearer",
		expires_in: token.expiration,
		scope: token.scope,
	};
}
