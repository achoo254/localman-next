import { OperationError } from "@localman/operations";
import express, { type Router } from "express";
import { asyncHandler } from "../../http/async-handler.js";
import {
	DEFAULT_SERVER_LIMIT_PER_MINUTE,
	ipRateLimit,
} from "../../http/ip-rate-limit.js";
import { noStore } from "../../http/no-store.js";
import type { Logger } from "../../logger.js";
import { AUTH_PATHS } from "../../operations/protocol-routes.js";
import {
	InvalidLogoutTokenError,
	rememberLogoutTokenJti,
	verifyLogoutToken,
} from "./logout-token.js";
import type { OidcApi } from "./oidc-api.js";
import { IdpUnavailableError, authUnavailableError } from "./oidc-errors.js";
import type { SessionStore } from "./session-store.js";

/** A logout token is a few hundred bytes; anything bigger is not one. */
const FORM_LIMIT = "16kb";

export interface BackchannelLogoutOptions {
	readonly oidc: OidcApi;
	readonly sessions: SessionStore;
	readonly logger: Logger;
	/** Calls per client IP and minute (default `DEFAULT_SERVER_LIMIT_PER_MINUTE`). */
	readonly limitPerMinute?: number;
}

function invalidToken(): OperationError {
	return new OperationError(
		400,
		"INVALID_LOGOUT_TOKEN",
		"The logout token is invalid",
	);
}

/**
 * `POST /auth/backchannel-logout`: the IdP posts `logout_token` (form
 * encoded) when an IdP session ends. The signed token is the
 * authentication, so this route is exempt from the CSRF origin check.
 * 200 once handled (a replayed `jti` is logged), 400 for a bad token.
 */
export function registerBackchannelLogout(
	router: Router,
	options: BackchannelLogoutOptions,
): void {
	const { oidc, sessions, logger } = options;
	router.post(
		AUTH_PATHS.backchannelLogout,
		noStore,
		ipRateLimit(options.limitPerMinute ?? DEFAULT_SERVER_LIMIT_PER_MINUTE),
		express.urlencoded({ extended: false, limit: FORM_LIMIT }),
		asyncHandler(async (req, res) => {
			// The spec mandates a form post; a JSON body is not a logout request.
			if (!req.is("application/x-www-form-urlencoded")) throw invalidToken();
			const body: unknown = req.body;
			const token =
				typeof body === "object" && body !== null && "logout_token" in body
					? body.logout_token
					: undefined;
			if (typeof token !== "string" || token === "") throw invalidToken();

			let issuer: string;
			let target: Awaited<ReturnType<typeof verifyLogoutToken>>;
			try {
				issuer = await oidc.issuer();
				target = await verifyLogoutToken(token, {
					jwks: await oidc.jwks(),
					issuer,
					clientId: oidc.clientId,
				});
			} catch (error) {
				if (error instanceof InvalidLogoutTokenError) {
					logger.info(
						{ reason: error.message },
						"Rejected a back-channel logout token",
					);
					throw invalidToken();
				}
				if (error instanceof IdpUnavailableError) {
					throw authUnavailableError();
				}
				throw error;
			}

			// Sessions end first: if recording the jti fails, the IdP's retry
			// still logs out (ending sessions twice is harmless).
			const ended = target.sid
				? await sessions.destroyBySid(target.sid, target.sub)
				: target.sub
					? await sessions.destroyBySub(target.sub)
					: 0;
			const firstUse = await rememberLogoutTokenJti(issuer, target.jti);
			logger.info(
				{ sessionsEnded: ended, replay: !firstUse },
				"Back-channel logout handled",
			);
			res.status(200).end();
		}),
	);
}
