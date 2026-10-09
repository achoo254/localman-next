import { OperationError } from "@localman/operations";
import type { Logger } from "../../logger.js";
import type { OidcClient } from "./oidc-client.js";
import {
	IdpUnavailableError,
	authUnavailableError,
	oauthErrorCode,
} from "./oidc-errors.js";
import type { SessionRefresher } from "./session-refresher.js";
import type { SessionStore } from "./session-store.js";

/** Tunelo's API: the only target the IdP exchanges Localman tokens for. */
export const TUNNEL_RESOURCE = "https://tunnel.hoandat.com";
export const TUNNEL_SCOPE = "tunnels:read";
/** Exchange again this long before the cached token expires. */
const REUSE_MARGIN_MS = 60_000;

export interface TunnelTokenExchangeOptions {
	readonly oidc: OidcClient;
	readonly sessions: SessionStore;
	readonly refresher: SessionRefresher;
	readonly logger: Logger;
}

interface CachedToken {
	readonly accessToken: string;
	readonly expiresAt: number;
}

function sessionEnded(): OperationError {
	return new OperationError(401, "UNAUTHENTICATED", "Authentication required");
}

/**
 * Trades a user's session for a short `tunnels:read` token of Tunelo's API
 * (RFC 8693, subject = the session's opaque access token). Tokens are
 * cached per session until shortly before they expire: the IdP token
 * endpoint is rate limited per IP and every exchange comes from this
 * server. Tokens are never logged.
 */
export class TunnelTokenExchange {
	private readonly cache = new Map<string, CachedToken>();
	private readonly inFlight = new Map<string, Promise<string>>();

	constructor(private readonly options: TunnelTokenExchangeOptions) {}

	async accessTokenFor(sessionId: string): Promise<string> {
		const cached = this.cache.get(sessionId);
		if (cached && cached.expiresAt - Date.now() > REUSE_MARGIN_MS) {
			// The cache can outlive its session (logout, back-channel): a token
			// is only handed out while the session it was issued for exists.
			if (await this.options.sessions.findById(sessionId)) {
				return cached.accessToken;
			}
			this.cache.delete(sessionId);
			throw sessionEnded();
		}
		let pending = this.inFlight.get(sessionId);
		if (!pending) {
			pending = this.exchange(sessionId).finally(() => {
				this.inFlight.delete(sessionId);
			});
			this.inFlight.set(sessionId, pending);
		}
		return pending;
	}

	private async exchange(sessionId: string): Promise<string> {
		const { oidc, sessions, refresher, logger } = this.options;
		const stored = await sessions.findById(sessionId);
		const session = stored ? await refresher.ensureFresh(stored) : null;
		if (!session) throw sessionEnded();
		let issued: { accessToken: string; expiresAt: Date };
		try {
			issued = await oidc.exchangeToken(
				session.tokens.accessToken,
				TUNNEL_RESOURCE,
				TUNNEL_SCOPE,
			);
		} catch (error) {
			const code = oauthErrorCode(error);
			if (code === "invalid_request") {
				// RFC 8693: the subject token is dead, so is the IdP session.
				await sessions.destroyById(session.id);
				throw sessionEnded();
			}
			if (error instanceof IdpUnavailableError) throw authUnavailableError();
			logger.warn({ sessionId, code }, "Token exchange failed");
			throw error;
		}
		this.prune();
		this.cache.set(sessionId, {
			accessToken: issued.accessToken,
			expiresAt: issued.expiresAt.getTime(),
		});
		return issued.accessToken;
	}

	private prune(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache) {
			if (entry.expiresAt <= now) this.cache.delete(key);
		}
	}
}
