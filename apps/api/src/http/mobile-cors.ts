import type { RequestHandler } from "express";
import { AUTH_PATHS } from "../operations/protocol-routes.js";

/**
 * Origins of the native app's WebView (Capacitor): `capacitor://localhost`
 * on iOS, `https://localhost` on Android. The only cross-origin callers of
 * the dashboard API, and only with a Bearer mobile session: CORS here
 * never allows credentials, so cookies stay same-origin
 * (docs/decisions/0005-mobile-session-handoff.md).
 */
export const MOBILE_APP_ORIGINS: readonly string[] = [
	"capacitor://localhost",
	"https://localhost",
];

const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE";
const ALLOW_HEADERS = "Authorization, Content-Type, Accept, Last-Event-ID";
/** Response headers the app reads (rate limits). */
const EXPOSE_HEADERS = "Retry-After";
const MAX_AGE_SECONDS = "600";

const API_PREFIX = "/api/v1/";
const AUTH_ROUTES: ReadonlySet<string> = new Set([
	AUTH_PATHS.mobileToken,
	AUTH_PATHS.mobileLogout,
]);

/** Paths the app calls: the REST API (with the live log) and its session. */
export function isMobileCorsPath(path: string): boolean {
	return path.startsWith(API_PREFIX) || AUTH_ROUTES.has(path);
}

/**
 * CORS for `MOBILE_APP_ORIGINS` on `isMobileCorsPath` routes. Preflights
 * of an allowed origin end here (204); other origins get no CORS header,
 * so the browser keeps refusing them as before.
 */
export function mobileCors(
	origins: readonly string[] = MOBILE_APP_ORIGINS,
): RequestHandler {
	const allowed = new Set(origins);
	return (req, res, next) => {
		if (!isMobileCorsPath(req.path)) {
			next();
			return;
		}
		res.vary("Origin");
		const origin = req.headers.origin;
		if (origin === undefined || !allowed.has(origin)) {
			next();
			return;
		}
		res.set("Access-Control-Allow-Origin", origin);
		res.set("Access-Control-Expose-Headers", EXPOSE_HEADERS);
		const preflight =
			req.method === "OPTIONS" &&
			req.headers["access-control-request-method"] !== undefined;
		if (!preflight) {
			next();
			return;
		}
		res.set("Access-Control-Allow-Methods", ALLOW_METHODS);
		res.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
		res.set("Access-Control-Max-Age", MAX_AGE_SECONDS);
		res.status(204).end();
	};
}
