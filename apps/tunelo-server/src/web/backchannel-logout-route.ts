import express, { type Router } from "express";
import { InvalidLogoutTokenError, verifyLogoutToken } from "./logout-token.js";
import { describeError } from "./oidc-errors.js";
import type { WebContext } from "./web-context.js";

export const BACKCHANNEL_LOGOUT_PATH = "/auth/backchannel-logout";
/** A logout token is a few hundred bytes; anything bigger is not one. */
const FORM_LIMIT = "16kb";

function logoutTokenOf(body: unknown): string | null {
	if (typeof body !== "object" || body === null) return null;
	const value = (body as Record<string, unknown>).logout_token;
	return typeof value === "string" && value !== "" ? value : null;
}

/**
 * `POST /auth/backchannel-logout`: the IdP posts `logout_token` (form
 * encoded) when an IdP session ends. The signed token is the authentication,
 * so there is no CSRF token here. 200 once handled (also when no session of
 * that `sid` exists here), 400 for a bad token, 503 when the JWKS is out of
 * reach so the IdP may retry.
 */
export function registerBackchannelLogout(
	router: Router,
	ctx: WebContext,
): void {
	const { store, logger, config } = ctx;
	router.post(
		BACKCHANNEL_LOGOUT_PATH,
		express.urlencoded({ extended: false, limit: FORM_LIMIT }),
		async (req, res) => {
			// The spec mandates a form post; anything else is not a logout request.
			const token = req.is("application/x-www-form-urlencoded")
				? logoutTokenOf(req.body)
				: null;
			if (!token) {
				res.status(400).json({ error: "invalid_request" });
				return;
			}
			let target: Awaited<ReturnType<typeof verifyLogoutToken>>;
			try {
				target = await verifyLogoutToken(token, {
					keys: ctx.logoutKeys,
					issuer: config.issuer,
					clientId: config.clientId,
				});
			} catch (error) {
				if (error instanceof InvalidLogoutTokenError) {
					logger.info(
						{ reason: error.message },
						"Rejected a back-channel logout token",
					);
					res.status(400).json({ error: "invalid_request" });
					return;
				}
				logger.warn(
					{ err: describeError(error) },
					"IdP keys unavailable for back-channel logout",
				);
				res.status(503).json({ error: "temporarily_unavailable" });
				return;
			}
			const ended = await store.deleteBySid(target.sid, target.sub);
			logger.info({ sessionsEnded: ended }, "Back-channel logout handled");
			res.status(200).end();
		},
	);
}
