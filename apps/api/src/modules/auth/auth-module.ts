import type { Request, Router } from "express";
import type { Env } from "../../config/env.js";
import { readCookie } from "../../http/cookies.js";
import type { Logger } from "../../logger.js";
import {
	AUTH_PATHS,
	INTERNAL_PATHS,
} from "../../operations/protocol-routes.js";
import { registerAuditEventsRoute } from "../audit/audit-events-route.js";
import type { BasicCredentials } from "../audit/basic-credentials.js";
import { deletePushSubscriptionsOfSessions } from "../notifications/push-subscription-model.js";
import { syncUserFromUserInfo } from "../users/user-sync.js";
import { authCookies } from "./auth-cookies.js";
import { createAuthRouter } from "./auth-routes.js";
import type { OidcApi } from "./oidc-api.js";
import { OidcClient } from "./oidc-client.js";
import { SessionRefresher } from "./session-refresher.js";
import { type Session, SessionStore } from "./session-store.js";
import type { TenantIdpSettings } from "./tenant-idp.js";
import { TenantOidcClients } from "./tenant-oidc-clients.js";
import { TokenCipher, parseKeyring } from "./token-cipher.js";
import { TunnelTokenExchange } from "./token-exchange.js";

export interface AuthSettings {
	readonly issuer: string;
	readonly clientId: string;
	readonly clientSecret: string;
	readonly publicUrl: string;
	/** `kid:base64key[,…]`; see token-cipher.ts. */
	readonly sessionEncryptionKey: string;
	/** `/auth/login` and `/auth/callback` per client IP and minute (default 20 each). */
	readonly loginLimitPerMinute?: number;
	/** Back-channel logouts and audit pushes per client IP and minute (default 600 each). */
	readonly serverLimitPerMinute?: number;
	/** Basic credentials of the IdP's audit pushes; no route without them. */
	readonly audit?: BasicCredentials;
	/** Reaching the IdP for other tenants; only the primary one without it. */
	readonly tenantIdp?: TenantIdpSettings;
}

export interface AuthModule {
	readonly router: Router;
	/** The request's session with a fresh access token, or `null`. */
	readonly authenticate: (req: Request) => Promise<Session | null>;
	/** `METHOD path` pairs exempt from the CSRF origin check. */
	readonly csrfExempt: readonly string[];
	readonly sessions: SessionStore;
	/**
	 * The request tenant's IdP: issuer and JWKS, e.g. to verify Localman
	 * MCP access tokens.
	 */
	readonly oidc: OidcApi;
	/** Session → Tunelo API token (RFC 8693), for the tunnel list. */
	readonly tunnelTokens: TunnelTokenExchange;
}

export function authSettingsFromEnv(env: Env): AuthSettings {
	return {
		issuer: env.OIDC_ISSUER,
		clientId: env.OIDC_CLIENT_ID,
		clientSecret: env.OIDC_CLIENT_SECRET,
		publicUrl: env.PUBLIC_URL,
		sessionEncryptionKey: env.SESSION_ENCRYPTION_KEY,
		tenantIdp: tenantIdpFromEnv(env),
		audit:
			env.AUDIT_CLIENT_ID && env.AUDIT_CLIENT_SECRET
				? {
						clientId: env.AUDIT_CLIENT_ID,
						clientSecret: env.AUDIT_CLIENT_SECRET,
					}
				: undefined,
	};
}

function tenantIdpFromEnv(env: Env): TenantIdpSettings | undefined {
	const { IDP_INTERNAL_URL, IDP_INTERNAL_SECRET } = env;
	const { IDP_LOOPBACK_URL, LOCALMAN_CLIENT_KEY } = env;
	if (
		!IDP_INTERNAL_URL ||
		!IDP_INTERNAL_SECRET ||
		!IDP_LOOPBACK_URL ||
		!LOCALMAN_CLIENT_KEY
	) {
		return undefined;
	}
	return {
		internalUrl: IDP_INTERNAL_URL,
		internalSecret: IDP_INTERNAL_SECRET,
		loopbackUrl: IDP_LOOPBACK_URL,
		clientKey: LOCALMAN_CLIENT_KEY,
	};
}

/** Wires the OIDC client, encrypted session store, refresher and routes. */
export function createAuthModule(
	settings: AuthSettings,
	logger: Logger,
): AuthModule {
	const keyring = parseKeyring(settings.sessionEncryptionKey);
	if (!keyring) throw new Error("SESSION_ENCRYPTION_KEY is invalid");
	const oidc = new TenantOidcClients(
		new OidcClient(settings),
		settings.tenantIdp,
	);
	// Push devices registered by a session stop with it.
	const sessions = new SessionStore(
		new TokenCipher(keyring),
		logger,
		deletePushSubscriptionsOfSessions,
	);
	const refresher = new SessionRefresher({
		store: sessions,
		oidc,
		logger,
		// Profile and the linked Telegram chat follow the IdP at every refresh.
		afterRefresh: async (session) => {
			const info = await oidc.userInfo(session.tokens.accessToken, session.sub);
			await syncUserFromUserInfo(info, session.sub);
		},
	});
	const cookies = authCookies(settings.publicUrl);
	const router = createAuthRouter({
		oidc,
		sessions,
		cookies,
		logger,
		loginLimitPerMinute: settings.loginLimitPerMinute,
		serverLimitPerMinute: settings.serverLimitPerMinute,
	});
	// Both authenticate otherwise (signed token, Basic + SET). The audit path
	// is exempt even when unconfigured so it answers 404, not 403.
	const csrfExempt = [
		`POST ${AUTH_PATHS.backchannelLogout}`,
		`POST ${INTERNAL_PATHS.auditEvents}`,
	];
	if (settings.audit) {
		registerAuditEventsRoute(router, {
			oidc,
			credentials: settings.audit,
			audience: new URL(INTERNAL_PATHS.auditEvents, settings.publicUrl).href,
			logger,
			limitPerMinute: settings.serverLimitPerMinute,
		});
	}

	return {
		router,
		authenticate: async (req) => {
			const value = readCookie(req, cookies.session.name);
			const session = value ? await sessions.findByCookie(value) : null;
			return session ? refresher.ensureFresh(session) : null;
		},
		csrfExempt,
		sessions,
		oidc,
		tunnelTokens: new TunnelTokenExchange({
			oidc,
			sessions,
			refresher,
			logger,
		}),
	};
}
