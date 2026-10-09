import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { type JWK, exportJWK, generateKeyPair } from "jose";
import Provider, {
	type Configuration,
	type KoaContextWithOIDC,
	errors,
} from "oidc-provider";
import { autoCompleteInteraction } from "./auto-interaction.js";
import { TOKEN_EXCHANGE_GRANT, exchangeToken } from "./fake-token-exchange.js";

/** Mutable profile of the single test account; tests change it in place. */
export interface FakeAccount {
	sub: string;
	username: string;
	email: string;
	name: string;
	telegram?: { chatId: string; username?: string };
}

export interface FakeIdpOptions {
	/** Already listening; the IdP is served on it. */
	readonly server: Server;
	readonly issuer: string;
	readonly clientSecret: string;
	/** Public origin of the Localman dashboard (redirect URIs). */
	readonly localmanPublicUrl: string;
	readonly backchannelLogoutUri: string;
	readonly account: FakeAccount;
	/**
	 * Account a sign-in completes as, picked per interaction request. Unset:
	 * always `account`. The E2E stack signs several users in through one IdP.
	 */
	readonly accountOf?: (req: IncomingMessage) => FakeAccount;
}

export interface FakeIdp {
	readonly provider: Provider;
	/** Private signing key, to forge logout tokens in tests. */
	readonly signingKey: JWK;
	/** Successful refresh_token grants so far. */
	refreshCount(): number;
}

function configuration(
	options: FakeIdpOptions,
	signingKey: JWK,
	accounts: ReadonlyMap<string, FakeAccount>,
): Configuration {
	return {
		clients: [
			{
				client_id: "localman-web",
				client_secret: options.clientSecret,
				token_endpoint_auth_method: "client_secret_basic",
				grant_types: [
					"authorization_code",
					"refresh_token",
					TOKEN_EXCHANGE_GRANT,
				],
				response_types: ["code"],
				redirect_uris: [`${options.localmanPublicUrl}/auth/callback`],
				post_logout_redirect_uris: [`${options.localmanPublicUrl}/`],
				backchannel_logout_uri: options.backchannelLogoutUri,
				backchannel_logout_session_required: true,
				scope: "openid profile email telegram",
				id_token_signed_response_alg: "ES256",
			},
		],
		jwks: { keys: [signingKey] },
		enabledJWA: { idTokenSigningAlgValues: ["ES256"] },
		claims: {
			openid: ["sub"],
			profile: ["preferred_username", "name", "telegram_linked"],
			email: ["email", "email_verified"],
			telegram: ["telegram_chat_id", "telegram_username"],
		},
		scopes: ["openid", "offline_access", "profile", "email", "telegram"],
		findAccount: async (_ctx, sub) => {
			const account = accounts.get(sub);
			if (!account) return undefined;
			return {
				accountId: sub,
				// The chat is released at userinfo only, as by the real IdP.
				claims: async (use) => ({
					sub,
					preferred_username: account.username,
					name: account.name,
					email: account.email,
					email_verified: false,
					telegram_linked: account.telegram !== undefined,
					...(use === "userinfo" && account.telegram
						? {
								telegram_chat_id: account.telegram.chatId,
								telegram_username: account.telegram.username,
							}
						: {}),
				}),
			};
		},
		responseTypes: ["code"],
		pkce: { required: () => true },
		interactions: { url: async (_ctx, i) => `/interaction/${i.uid}` },
		// No offline_access: refresh tokens live with the IdP session.
		issueRefreshToken: async (_ctx, client) =>
			client.grantTypeAllowed("refresh_token"),
		rotateRefreshToken: true,
		ttl: {
			AccessToken: 900,
			AuthorizationCode: 60,
			IdToken: 900,
			Interaction: 600,
			Session: 3600,
			Grant: 3600,
			RefreshToken: 3600,
		},
		cookies: { keys: ["fake-idp-cookie-key"] },
		// The app under test listens on loopback, which oidc-provider's SSRF
		// guard refuses; drop its dispatcher so back-channel logout reaches it.
		fetch: (url, init) => {
			const { dispatcher: _ssrfGuard, ...rest } = init as RequestInit & {
				dispatcher?: unknown;
			};
			return globalThis.fetch(url, rest);
		},
		features: {
			devInteractions: { enabled: false },
			rpInitiatedLogout: { enabled: true },
			backchannelLogout: { enabled: true },
			userinfo: { enabled: true },
			resourceIndicators: {
				enabled: true,
				// A plain sign-in gets an opaque access token (no resource).
				defaultResource: async () => undefined,
				getResourceServerInfo: async () => {
					throw new errors.InvalidTarget("no resource on sign-in");
				},
				useGrantedResource: async () => false,
			},
		},
	};
}

/**
 * An OpenID provider shaped like auth.hoandat.com for `localman-web`:
 * confidential client, PKCE, refresh tokens without offline_access that
 * rotate, back-channel logout with `sid`, the `telegram` scope at userinfo
 * and the token exchange to Tunelo. Sign-in and consent complete
 * automatically for the one test account.
 */
export async function startFakeIdp(options: FakeIdpOptions): Promise<FakeIdp> {
	const { privateKey } = await generateKeyPair("ES256", { extractable: true });
	const signingKey: JWK = {
		...(await exportJWK(privateKey)),
		kid: "fake-idp-key",
		alg: "ES256",
		use: "sig",
	};
	const accounts = new Map<string, FakeAccount>([
		[options.account.sub, options.account],
	]);
	const provider = new Provider(
		options.issuer,
		configuration(options, signingKey, accounts),
	);
	provider.registerGrantType(TOKEN_EXCHANGE_GRANT, exchangeToken, [
		"subject_token",
		"subject_token_type",
		"resource",
		"scope",
	]);
	let refreshes = 0;
	provider.on("grant.success", (ctx: KoaContextWithOIDC) => {
		if (ctx.oidc.params?.grant_type === "refresh_token") refreshes += 1;
	});

	const callback = provider.callback();
	options.server.on("request", (req: IncomingMessage, res: ServerResponse) => {
		if (req.url?.startsWith("/interaction/")) {
			const account = options.accountOf?.(req) ?? options.account;
			accounts.set(account.sub, account);
			autoCompleteInteraction(provider, account.sub, req, res).catch(
				(error: unknown) => {
					res.statusCode = 500;
					res.end(String(error));
				},
			);
			return;
		}
		callback(req, res);
	});
	return { provider, signingKey, refreshCount: () => refreshes };
}
