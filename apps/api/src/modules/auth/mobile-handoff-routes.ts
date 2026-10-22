import { OperationError } from "@localman/operations";
import { type Locale, isLocale } from "@localman/shared";
import express, { type Request, type Response, type Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/async-handler.js";
import { bearerTokenOf } from "../../http/bearer-token.js";
import { ipRateLimit } from "../../http/ip-rate-limit.js";
import { noStore } from "../../http/no-store.js";
import { AUTH_PATHS } from "../../operations/protocol-routes.js";
import {
	type MobileAppSettings,
	mobileSignInEnabled,
	registerAppLinkAssociation,
} from "./app-link-association.js";
import { loginRateLimit, redirectToApp } from "./auth-redirects.js";
import type { MobileSignIn } from "./login-transaction.js";
import {
	sendCallbackFallback,
	sendConfirmPage,
	sendExpiredPage,
} from "./mobile-confirm-page.js";
import type {
	MobileHandoffStore,
	NewMobileHandoff,
} from "./mobile-handoff-model.js";
import type { SessionStore } from "./session-store.js";

export interface MobileHandoffRoutesOptions {
	readonly sessions: SessionStore;
	readonly handoffs: MobileHandoffStore;
	readonly settings: MobileAppSettings | undefined;
	/** Confirmations and code redemptions per client IP and minute. */
	readonly limitPerMinute: number;
}

/** RFC 7636 §4.1: 43 to 128 unreserved characters. */
const tokenRequest = z.object({
	code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
	code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
});

const LOCALES: readonly Locale[] = ["en", "zh-CN", "vi"];

/** The browser's language for pages reached without a sign-in. */
function browserLocale(req: Request): Locale {
	const accepted = req.acceptsLanguages(...LOCALES);
	return typeof accepted === "string" && isLocale(accepted) ? accepted : "en";
}

function invalidHandoff(): OperationError {
	return new OperationError(
		400,
		"MOBILE_HANDOFF_INVALID",
		"The sign-in code is invalid or was already used",
	);
}

/**
 * The IdP callback of a native app sign-in: no session and no cookie
 * yet, the IdP tokens wait sealed in a handoff while the user confirms.
 */
export async function startMobileHandoff(
	res: Response,
	handoffs: MobileHandoffStore,
	mobile: MobileSignIn,
	input: Omit<NewMobileHandoff, "codeChallenge" | "appState"> & {
		readonly account: string;
	},
): Promise<void> {
	const { account, ...fields } = input;
	const code = await handoffs.create({
		...fields,
		codeChallenge: mobile.codeChallenge,
		appState: mobile.appState,
	});
	sendConfirmPage(res, { locale: mobile.locale, account, code });
}

/**
 * Native app sign-in after the IdP (docs/decisions/0005): confirmation,
 * code redemption, sign-out, the callback's fallback page and the app
 * association files. Protocol routes, see operations/protocol-routes.ts.
 */
export function registerMobileHandoff(
	router: Router,
	options: MobileHandoffRoutesOptions,
): void {
	const { sessions, handoffs, settings } = options;

	router.post(
		AUTH_PATHS.mobileConfirm,
		noStore,
		loginRateLimit(options.limitPerMinute),
		express.urlencoded({ extended: false, limit: "1kb" }),
		asyncHandler(async (req, res) => {
			const body: unknown = req.body;
			const fields = typeof body === "object" && body !== null ? body : {};
			const code = "code" in fields ? fields.code : undefined;
			const action = "action" in fields ? fields.action : undefined;
			if (action === "continue") {
				const appState = await handoffs.confirm(code);
				if (appState !== null && typeof code === "string") {
					redirectToApp(res, { code }, appState);
					return;
				}
			} else {
				const appState = await handoffs.cancel(code);
				if (appState !== null) {
					redirectToApp(res, { error: "access_denied" }, appState);
					return;
				}
			}
			sendExpiredPage(res, browserLocale(req));
		}),
	);

	router.post(
		AUTH_PATHS.mobileToken,
		noStore,
		ipRateLimit(options.limitPerMinute),
		asyncHandler(async (req, res) => {
			if (!mobileSignInEnabled(settings)) {
				throw new OperationError(404, "NOT_FOUND", "Route not found");
			}
			const parsed = tokenRequest.safeParse(req.body);
			if (!parsed.success) throw invalidHandoff();
			const result = await handoffs.redeem(
				parsed.data.code,
				parsed.data.code_verifier,
			);
			if (!result.ok) {
				if (result.reason === "invalid") throw invalidHandoff();
				throw new OperationError(
					400,
					"MOBILE_HANDOFF_EXPIRED",
					"The sign-in code has expired; sign in again",
				);
			}
			const { cookieValue, expiresAt } = await sessions.create({
				...result.handoff,
				client: "mobile",
			});
			// Slides with use (30 days idle, 90 at most), like a browser's.
			res.status(200).json({
				token: cookieValue,
				tokenType: "Bearer",
				expiresAt: expiresAt.toISOString(),
			});
		}),
	);

	router.post(
		AUTH_PATHS.mobileLogout,
		noStore,
		ipRateLimit(options.limitPerMinute),
		asyncHandler(async (req, res) => {
			const token = bearerTokenOf(req);
			if (token === undefined) {
				throw new OperationError(
					401,
					"UNAUTHENTICATED",
					"Authentication required",
				);
			}
			const session = await sessions.findByBearer(token);
			// Its live logs end with it (the session store's hook).
			if (session) await sessions.destroyById(session.id);
			res.status(204).end();
		}),
	);

	router.get(AUTH_PATHS.mobileCallback, noStore, (req, res) => {
		sendCallbackFallback(res, {
			locale: browserLocale(req),
			failed: req.query.code === undefined,
			href: req.originalUrl,
		});
	});

	registerAppLinkAssociation(router, settings);
}
