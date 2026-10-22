import { OperationError } from "@localman/operations";
import type { RequestHandler } from "express";
import { tenantSettings } from "../tenancy/tenant-settings.js";
import { bearerTokenOf } from "./bearer-token.js";

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

export interface CsrfGuardOptions {
	/**
	 * Exact origins (scheme://host[:port]) allowed to send mutations,
	 * besides the dashboard origin of the request's tenant.
	 */
	readonly allowedOrigins: readonly string[];
	/** `METHOD path` pairs authenticated by other means (e.g. a signed token). */
	readonly exempt?: readonly string[];
}

/**
 * Rejects state-changing requests that a browser sent from another site.
 * The session cookie is SameSite=Strict, but the public mock runtime lives
 * on a sibling subdomain (same site), so the Origin is checked as well:
 * a mutation must carry an allowed `Origin` or `Sec-Fetch-Site: same-origin`.
 * Runs before body parsing so a forged request is never parsed.
 *
 * A request with `Authorization: Bearer` and no `Cookie` header at all
 * (the native app's mobile session) skips the Origin check: a browser
 * never attaches that header on its own, a cross-origin page can set it
 * only after a CORS preflight that only the app origins pass, and the
 * token is not ambient, so a forged request cannot carry it. A Bearer
 * request that also carries cookies is checked like any other.
 */
export function createCsrfGuard(options: CsrfGuardOptions): RequestHandler {
	const origins = new Set(options.allowedOrigins);
	const exempt = new Set(options.exempt ?? []);
	return (req, _res, next) => {
		if (SAFE_METHODS.has(req.method)) {
			next();
			return;
		}
		if (exempt.has(`${req.method} ${req.path}`)) {
			next();
			return;
		}
		if (bearerTokenOf(req) !== undefined && req.headers.cookie === undefined) {
			next();
			return;
		}
		const origin = req.headers.origin;
		const fetchSite = req.headers["sec-fetch-site"];
		const allowed =
			origin !== undefined &&
			(origins.has(origin) || origin === tenantSettings().publicUrl);
		if (allowed || fetchSite === "same-origin") {
			next();
			return;
		}
		next(
			new OperationError(403, "CSRF_REJECTED", "Cross-site request rejected"),
		);
	};
}
