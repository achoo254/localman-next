import { type JWTVerifyGetKey, createRemoteJWKSet } from "jose";
import * as oidc from "openid-client";
import type { IdpTransport } from "./oidc-api.js";
import { IdpUnavailableError } from "./oidc-errors.js";
import { type TokenSet, toTokenSet } from "./token-set.js";

/**
 * `telegram` releases the linked chat at userinfo. No `offline_access` (the
 * IdP answers `invalid_scope`) and no Localman API scope or `resource`, so
 * the access token stays opaque: only an opaque token is accepted as the
 * subject of the token exchange.
 */
export const LOGIN_SCOPE = "openid profile email telegram";
export const CALLBACK_PATH = "/auth/callback";
const DISCOVERY_TIMEOUT_SECONDS = 10;

export interface OidcClientSettings {
	readonly issuer: string;
	readonly clientId: string;
	readonly clientSecret: string;
	/** Public origin of the dashboard; redirect URIs are built from it. */
	readonly publicUrl: string;
	/** How a tenant's IdP is reached; the issuer's public URL when absent. */
	readonly transport?: IdpTransport;
}

export interface AuthorizationRequest {
	readonly state: string;
	readonly nonce: string;
	readonly codeVerifier: string;
	/**
	 * `create` opens the IdP's sign-up page (only if it advertises it);
	 * `none` is a silent sign-in, answered at once or with `login_required`.
	 */
	readonly prompt?: "create" | "none";
	/** Web language (a checked `Locale`), sent as `ui_locales` to the IdP. */
	readonly uiLocale?: string;
}

interface Discovered {
	readonly config: oidc.Configuration;
	readonly jwks: JWTVerifyGetKey;
}

/**
 * OpenID Connect client `localman-web` (confidential, Code + PKCE).
 * Discovery is lazy and retried after a failure, so the API starts and
 * serves everything else while the IdP is down.
 */
export class OidcClient {
	readonly redirectUri: string;
	readonly postLogoutRedirectUri: string;
	private discovered: Promise<Discovered> | undefined;

	constructor(private readonly settings: OidcClientSettings) {
		this.redirectUri = new URL(CALLBACK_PATH, settings.publicUrl).href;
		this.postLogoutRedirectUri = new URL("/", settings.publicUrl).href;
	}

	get clientId(): string {
		return this.settings.clientId;
	}

	private async discover(): Promise<Discovered> {
		const { transport } = this.settings;
		if (transport) {
			const config = new oidc.Configuration(
				await transport.metadata(),
				this.settings.clientId,
				{ redirect_uris: [this.redirectUri] },
				oidc.ClientSecretBasic(this.settings.clientSecret),
			);
			config[oidc.customFetch] = transport.fetch;
			return { config, jwks: transport.jwks };
		}
		const issuer = new URL(this.settings.issuer);
		const config = await oidc.discovery(
			issuer,
			this.settings.clientId,
			{ redirect_uris: [this.redirectUri] },
			oidc.ClientSecretBasic(this.settings.clientSecret),
			{
				timeout: DISCOVERY_TIMEOUT_SECONDS,
				// Plain http only reaches here outside production (env check).
				execute:
					issuer.protocol === "http:" ? [oidc.allowInsecureRequests] : [],
			},
		);
		const jwksUri = config.serverMetadata().jwks_uri;
		if (!jwksUri) throw new Error("IdP metadata has no jwks_uri");
		return { config, jwks: createRemoteJWKSet(new URL(jwksUri)) };
	}

	private async load(): Promise<Discovered> {
		this.discovered ??= this.discover();
		try {
			return await this.discovered;
		} catch (error) {
			this.discovered = undefined;
			throw new IdpUnavailableError(error);
		}
	}

	async issuer(): Promise<string> {
		return (await this.load()).config.serverMetadata().issuer;
	}

	async jwks(): Promise<JWTVerifyGetKey> {
		return (await this.load()).jwks;
	}

	async authorizationUrl(request: AuthorizationRequest): Promise<URL> {
		const { config } = await this.load();
		const supported = config.serverMetadata().prompt_values_supported;
		const params: Record<string, string> = {
			redirect_uri: this.redirectUri,
			scope: LOGIN_SCOPE,
			code_challenge: await oidc.calculatePKCECodeChallenge(
				request.codeVerifier,
			),
			code_challenge_method: "S256",
			state: request.state,
			nonce: request.nonce,
		};
		const { prompt } = request;
		if (
			prompt === "none" ||
			(prompt === "create" &&
				Array.isArray(supported) &&
				supported.includes("create"))
		) {
			params.prompt = prompt;
		}
		if (request.uiLocale) params.ui_locales = request.uiLocale;
		return oidc.buildAuthorizationUrl(config, params);
	}

	async exchangeCode(
		callbackUrl: URL,
		checks: { state: string; nonce: string; codeVerifier: string },
	): Promise<TokenSet> {
		const { config } = await this.load();
		const response = await oidc.authorizationCodeGrant(config, callbackUrl, {
			pkceCodeVerifier: checks.codeVerifier,
			expectedState: checks.state,
			expectedNonce: checks.nonce,
			idTokenExpected: true,
		});
		return toTokenSet(response);
	}

	async refresh(refreshToken: string): Promise<TokenSet> {
		const { config } = await this.load();
		return toTokenSet(await oidc.refreshTokenGrant(config, refreshToken));
	}

	async userInfo(
		accessToken: string,
		expectedSub: string,
	): Promise<oidc.UserInfoResponse> {
		const { config } = await this.load();
		return oidc.fetchUserInfo(config, accessToken, expectedSub);
	}

	/** RFC 8693 exchange; returns the issued access token and its expiry. */
	async exchangeToken(
		subjectToken: string,
		resource: string,
		scope: string,
	): Promise<{ accessToken: string; expiresAt: Date }> {
		const { config } = await this.load();
		const response = await oidc.genericGrantRequest(
			config,
			"urn:ietf:params:oauth:grant-type:token-exchange",
			{
				subject_token: subjectToken,
				subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
				resource,
				scope,
			},
		);
		const { accessToken, accessTokenExpiresAt } = toTokenSet(response);
		return { accessToken, expiresAt: accessTokenExpiresAt };
	}

	/** RP-initiated logout URL, or `null` when the IdP offers none. */
	async endSessionUrl(idTokenHint: string | undefined): Promise<URL | null> {
		const { config } = await this.load();
		if (!config.serverMetadata().end_session_endpoint) return null;
		const params: Record<string, string> = {
			post_logout_redirect_uri: this.postLogoutRedirectUri,
		};
		if (idTokenHint) params.id_token_hint = idTokenHint;
		return oidc.buildEndSessionUrl(config, params);
	}
}
