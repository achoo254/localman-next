import { cookieDomainFor } from "@achoo254/app-shell/preferences";
import { type Request, type Response, Router } from "express";
import { footLinks } from "./brand.js";
import { renderHomePage } from "./home-page.js";
import { isLocale, pickLocale } from "./i18n/locale.js";
import {
	type MessageKey,
	type Translator,
	translator,
} from "./i18n/messages.js";
import { LANGUAGE_PATH } from "./layout.js";
import { renderTunnelsPage } from "./tunnels-page.js";
import type { WebContext } from "./web-context.js";
import { clearCookie, readCookie, setCookie } from "./web-cookies.js";

/** Codes `/?error=` may carry after a failed sign-in or an expired form. */
export type NoticeCode =
	| "login_failed"
	| "login_expired"
	| "access_denied"
	| "idp_unavailable"
	| "csrf";

const NOTICES: Readonly<Record<NoticeCode, MessageKey>> = {
	login_failed: "error.login_failed",
	login_expired: "error.login_expired",
	access_denied: "error.access_denied",
	idp_unavailable: "error.idp_unavailable",
	csrf: "error.csrf",
};

function isNoticeCode(value: unknown): value is NoticeCode {
	return typeof value === "string" && Object.hasOwn(NOTICES, value);
}

/** Back to the console, which explains what happened. */
export function redirectWithNotice(res: Response, code: NoticeCode): void {
	res.set("cache-control", "no-store");
	res.redirect(303, `/?error=${code}`);
}

export function requestTranslator(ctx: WebContext, req: Request): Translator {
	return translator(
		pickLocale(
			readCookie(req, ctx.cookies.lang.name) ??
				readCookie(req, ctx.cookies.legacyLang),
			req.headers["accept-language"],
		),
	);
}

function noticeOf(i18n: Translator, code: unknown): string | null {
	return isNoticeCode(code) ? i18n.t(NOTICES[code]) : null;
}

/** `GET /` (home or tunnel list) and `GET /lang` (language switcher). */
export function createPageRouter(ctx: WebContext): Router {
	const router = Router();

	router.get("/", async (req, res) => {
		const i18n = requestTranslator(ctx, req);
		const notice = noticeOf(i18n, req.query.error);
		const session = await ctx.sessions.resolve(req);
		// The same URL serves both states and the signed-in one is private.
		res.set("cache-control", "no-store");
		res.type("html");
		if (!session) {
			// A cookie whose session ended (expired, logged out elsewhere) goes too.
			if (readCookie(req, ctx.cookies.session.name)) {
				clearCookie(res, ctx.cookies.session);
			}
			res.send(
				renderHomePage({ i18n, tunnelDomain: ctx.tunnelDomain, notice }),
			);
			return;
		}
		const { profile } = session;
		const idpAccountUrl = `${ctx.config.issuer}/account`;
		res.send(
			renderTunnelsPage({
				i18n,
				notice,
				account: {
					user: {
						name: profile.name ?? profile.username,
						email: profile.email,
						picture: profile.picture,
					},
					csrfToken: ctx.csrf.issue(session.id),
					idpAccountUrl,
				},
				tunnels: ctx.listTunnels(session.sub),
				devicesUrl: idpAccountUrl,
			}),
		);
	});

	// A GET that only stores a language preference; the console has one page.
	router.get(LANGUAGE_PATH, (req, res) => {
		const locale = req.query.set;
		if (isLocale(locale)) {
			// On the root domain, so every hoandat.com app shows the same language.
			const domain = cookieDomainFor(req.hostname, footLinks().domain);
			const { lang } = ctx.cookies;
			setCookie(
				res,
				domain === undefined
					? lang
					: { ...lang, options: { ...lang.options, domain } },
				locale,
			);
		}
		res.set("cache-control", "no-store");
		res.redirect(303, "/");
	});

	return router;
}
