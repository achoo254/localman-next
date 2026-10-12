import express, { type Request, type Router } from "express";
import { LOGOUT_PATH } from "./layout.js";
import { describeError } from "./oidc-errors.js";
import { redirectWithNotice } from "./page-routes.js";
import type { WebContext } from "./web-context.js";
import { clearCookie, readCookie } from "./web-cookies.js";

/** The logout form carries one short field. */
const FORM_LIMIT = "4kb";

function formField(req: Request, name: string): unknown {
	const body: unknown = req.body;
	return typeof body === "object" && body !== null && name in body
		? (body as Record<string, unknown>)[name]
		: undefined;
}

/**
 * `POST /auth/logout` (CSRF): ends the session here, revokes its refresh
 * token and hands over to the IdP's RP-initiated logout.
 */
export function registerLogout(router: Router, ctx: WebContext): void {
	const { oidc, store, cookies, csrf, logger } = ctx;
	router.post(
		LOGOUT_PATH,
		express.urlencoded({ extended: false, limit: FORM_LIMIT }),
		async (req, res) => {
			const raw = readCookie(req, cookies.session.name);
			const session = raw ? await store.findByCookie(raw) : null;
			if (!session) {
				clearCookie(res, cookies.session);
				res.redirect(303, "/");
				return;
			}
			if (!csrf.verify(session.id, formField(req, "csrf"))) {
				redirectWithNotice(res, "csrf");
				return;
			}
			await store.deleteById(session.id);
			clearCookie(res, cookies.session);
			logger.info({ sessionId: session.id }, "Web session ended by sign-out");
			// The local session is gone either way; IdP steps are best effort.
			if (session.refreshToken) {
				await oidc.revoke(session.refreshToken).catch((error: unknown) => {
					logger.warn(
						{ err: describeError(error) },
						"Refresh token revocation failed",
					);
				});
			}
			let target = "/";
			try {
				const url = await oidc.endSessionUrl(session.idToken);
				if (url) target = url.href;
			} catch (error) {
				logger.warn(
					{ err: describeError(error) },
					"IdP logout URL unavailable",
				);
			}
			res.redirect(303, target);
		},
	);
}
