import type { IdpTransport } from "@localman/tenancy";
import { type JWTVerifyGetKey, createRemoteJWKSet } from "jose";
import type pino from "pino";
import { listByOwner } from "../tunnel-directory.js";
import type { TunnelListItem } from "../tunnel-directory.js";
import { CsrfTokens } from "./csrf.js";
import { SessionResolver } from "./session-middleware.js";
import { PendingSignIns, SIGN_IN_LIMIT_PER_MINUTE } from "./sign-in-guards.js";
import { TokenCipher, deriveKey } from "./token-cipher.js";
import type { WebConfig } from "./web-config.js";
import { type WebCookies, webCookies } from "./web-cookies.js";
import { WebOidcClient } from "./web-oidc-client.js";
import { WebSessionStore } from "./web-session-store.js";

const JWKS_TIMEOUT_MS = 5_000;

/** Everything the console's routes share, built once at startup. */
export interface WebContext {
	readonly config: WebConfig;
	readonly logger: pino.Logger;
	readonly cipher: TokenCipher;
	readonly csrf: CsrfTokens;
	readonly cookies: WebCookies;
	readonly store: WebSessionStore;
	readonly oidc: WebOidcClient;
	readonly sessions: SessionResolver;
	/** Sign-ins started and not yet called back (single-use transactions). */
	readonly pendingSignIns: PendingSignIns;
	/** `/auth/login` and `/auth/callback` calls per client IP and minute. */
	readonly signInLimitPerMinute: number;
	/** IdP signing keys that verify back-channel logout tokens. */
	readonly logoutKeys: JWTVerifyGetKey;
	/** Live tunnels of one account (same process, no HTTP round trip). */
	readonly listTunnels: (sub: string) => TunnelListItem[];
	/** Domain shown in the introduction (`tunnel.hoandat.com`). */
	readonly tunnelDomain: string;
}

export interface WebContextOptions {
	readonly config: WebConfig;
	readonly logger: pino.Logger;
	readonly tunnelDomain: string;
	readonly listTunnels?: (sub: string) => TunnelListItem[];
	/** Tests only: lets openid-client talk to an http:// issuer. */
	readonly allowInsecureRequests?: boolean;
	/** Default `SIGN_IN_LIMIT_PER_MINUTE`. */
	readonly signInLimitPerMinute?: number;
	/** Another tenant's IdP: discovery, endpoints and keys without its DNS. */
	readonly transport?: IdpTransport;
}

export function createWebContext(options: WebContextOptions): WebContext {
	const { config, logger } = options;
	const cipher = new TokenCipher(config.sessionKey);
	const cookies = webCookies(config.publicUrl);
	const store = new WebSessionStore(cipher, logger);
	const oidc = new WebOidcClient({
		issuer: config.issuer,
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		publicUrl: config.publicUrl,
		allowInsecureRequests: options.allowInsecureRequests,
		transport: options.transport,
	});
	return {
		config,
		logger,
		cipher,
		csrf: new CsrfTokens(deriveKey(config.sessionKey, "csrf")),
		cookies,
		store,
		oidc,
		sessions: new SessionResolver({
			store,
			oidc,
			sessionCookie: cookies.session.name,
			logger,
		}),
		pendingSignIns: new PendingSignIns(),
		signInLimitPerMinute:
			options.signInLimitPerMinute ?? SIGN_IN_LIMIT_PER_MINUTE,
		logoutKeys:
			options.transport?.jwks ??
			createRemoteJWKSet(new URL(`${config.issuer}/jwks`), {
				timeoutDuration: JWKS_TIMEOUT_MS,
			}),
		listTunnels: options.listTunnels ?? ((sub) => listByOwner(sub)),
		tunnelDomain: options.tunnelDomain,
	};
}
