import * as oidc from "openid-client";
import { IdpUnavailableError } from "./oidc-errors.js";
import type { SessionTokens, WebProfile } from "./web-session-store.js";

/**
 * No API scope and no `resource`: the console reads tunnels in process by
 * `sub`, so the opaque access token only serves userinfo. No
 * `offline_access` either: the IdP binds this client's refresh tokens to the
 * IdP session, so signing out there ends the console session at the next
 * refresh (within 15 minutes) even if the back-channel logout is lost.
 */
export const LOGIN_SCOPE = "openid profile";
export const CALLBACK_PATH = "/auth/callback";
const DISCOVERY_TIMEOUT_SECONDS = 10;
const REQUEST_TIMEOUT_SECONDS = 10;
/** Used when the token response omits `expires_in`; refreshes early. */
const FALLBACK_ACCESS_TTL_SECONDS = 60;
/** The IdP's grant idle window, when it does not state the refresh expiry. */
const REFRESH_IDLE_SECONDS = 30 * 24 * 60 * 60;

export interface WebOidcSettings {
	readonly issuer: string;
	readonly clientId: string;
	readonly clientSecret: string;
	readonly publicUrl: string;
	/** Tests only: lets openid-client talk to an http:// issuer. */
	readonly allowInsecureRequests?: boolean;
}

/** Tokens of one response, plus what the console reads from the ID token. */
export interface IssuedTokens extends SessionTokens {
	/** Only for userinfo right after sign-in; never stored. */
	readonly accessToken: string;
	readonly sub: string | null;
	readonly sid: string | null;
}

/** Longest display name or username kept; longer values are cut. */
const MAX_PROFILE_LENGTH = 200;

function stringClaim(
	claims: Readonly<Record<string, unknown>> | undefined,
	name: string,
): string | null {
	const value = claims?.[name];
	return typeof value === "string" && value.trim() !== ""
		? value.trim().slice(0, MAX_PROFILE_LENGTH)
		: null;
}

function toIssuedTokens(
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
		const config = await oidc.discovery(
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
		// Token, refresh and revocation calls sit in a browser round trip.
		config.timeout = REQUEST_TIMEOUT_SECONDS;
		return config;
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

	/** `preferred_username` and `name` from userinfo (checked against `sub`). */
	async profile(accessToken: string, expectedSub: string): Promise<WebProfile> {
		const config = await this.load();
		const claims = await oidc.fetchUserInfo(config, accessToken, expectedSub);
		return {
			username: stringClaim(claims, "preferred_username"),
			name: stringClaim(claims, "name"),
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
