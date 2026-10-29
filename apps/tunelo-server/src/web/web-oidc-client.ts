import * as oidc from "openid-client";
import {
	type IssuedTokens,
	stringClaim,
	toIssuedTokens,
} from "./issued-tokens.js";
import { IdpUnavailableError } from "./oidc-errors.js";
import type { WebProfile } from "./web-session-store.js";

export type { IssuedTokens } from "./issued-tokens.js";

/**
 * No API scope and no `resource`: the console reads tunnels in process by
 * `sub`, so the opaque access token only serves userinfo (name, picture and
 * email for the account menu). No
 * `offline_access` either: the IdP binds this client's refresh tokens to the
 * IdP session, so signing out there ends the console session at the next
 * refresh (within 15 minutes) even if the back-channel logout is lost.
 */
export const LOGIN_SCOPE = "openid profile email";
export const CALLBACK_PATH = "/auth/callback";
const DISCOVERY_TIMEOUT_SECONDS = 10;
const REQUEST_TIMEOUT_SECONDS = 10;
export interface WebOidcSettings {
	readonly issuer: string;
	readonly clientId: string;
	readonly clientSecret: string;
	readonly publicUrl: string;
	/** Tests only: lets openid-client talk to an http:// issuer. */
	readonly allowInsecureRequests?: boolean;
}

/**
 * OpenID Connect client `tunelo-web` (confidential, Code + PKCE S256).
 * Discovery is lazy and retried after a failure, so the server starts and
 * relays tunnels while the IdP is down.
 */
export class WebOidcClient {
	readonly redirectUri: string;
	readonly postLogoutRedirectUri: string;
	private discovered: Promise<oidc.Configuration> | undefined;

	constructor(private readonly settings: WebOidcSettings) {
		this.redirectUri = new URL(CALLBACK_PATH, settings.publicUrl).href;
		this.postLogoutRedirectUri = new URL("/", settings.publicUrl).href;
	}

	private async load(): Promise<oidc.Configuration> {
		this.discovered ??= this.discover();
		try {
			return await this.discovered;
		} catch (error) {
			this.discovered = undefined;
			throw new IdpUnavailableError(error);
		}
	}

	private async discover(): Promise<oidc.Configuration> {
		const config = await this.discoverPublicly();
		// Token, refresh and revocation calls sit in a browser round trip.
		config.timeout = REQUEST_TIMEOUT_SECONDS;
		return config;
	}

	private discoverPublicly(): Promise<oidc.Configuration> {
		return oidc.discovery(
			new URL(this.settings.issuer),
			this.settings.clientId,
			{
				redirect_uris: [this.redirectUri],
				id_token_signed_response_alg: "ES256",
			},
			oidc.ClientSecretBasic(this.settings.clientSecret),
			{
				timeout: DISCOVERY_TIMEOUT_SECONDS,
				execute: this.settings.allowInsecureRequests
					? [oidc.allowInsecureRequests]
					: [],
			},
		);
	}

	async authorizationUrl(request: {
		state: string;
		nonce: string;
		codeVerifier: string;
		uiLocale: string;
	}): Promise<URL> {
		const config = await this.load();
		return oidc.buildAuthorizationUrl(config, {
			redirect_uri: this.redirectUri,
			scope: LOGIN_SCOPE,
			code_challenge: await oidc.calculatePKCECodeChallenge(
				request.codeVerifier,
			),
			code_challenge_method: "S256",
			state: request.state,
			nonce: request.nonce,
			ui_locales: request.uiLocale,
		});
	}

	async exchangeCode(
		callbackUrl: URL,
		checks: { state: string; nonce: string; codeVerifier: string },
	): Promise<IssuedTokens> {
		const config = await this.load();
		const response = await oidc.authorizationCodeGrant(config, callbackUrl, {
			pkceCodeVerifier: checks.codeVerifier,
			expectedState: checks.state,
			expectedNonce: checks.nonce,
			idTokenExpected: true,
		});
		return toIssuedTokens(response);
	}

	/** Profile claims from userinfo (checked against `sub`). */
	async profile(accessToken: string, expectedSub: string): Promise<WebProfile> {
		const config = await this.load();
		const claims = await oidc.fetchUserInfo(config, accessToken, expectedSub);
		return {
			username: stringClaim(claims, "preferred_username"),
			name: stringClaim(claims, "name"),
			email: stringClaim(claims, "email"),
			picture: stringClaim(claims, "picture"),
		};
	}

	async refresh(refreshToken: string): Promise<IssuedTokens> {
		const config = await this.load();
		return toIssuedTokens(await oidc.refreshTokenGrant(config, refreshToken));
	}

	async revoke(refreshToken: string): Promise<void> {
		const config = await this.load();
		await oidc.tokenRevocation(config, refreshToken, {
			token_type_hint: "refresh_token",
		});
	}

	/** RP-initiated logout URL, or `null` when the IdP offers none. */
	async endSessionUrl(idTokenHint: string | null): Promise<URL | null> {
		const config = await this.load();
		if (!config.serverMetadata().end_session_endpoint) return null;
		return oidc.buildEndSessionUrl(config, {
			post_logout_redirect_uri: this.postLogoutRedirectUri,
			...(idTokenHint ? { id_token_hint: idTokenHint } : {}),
		});
	}
}
