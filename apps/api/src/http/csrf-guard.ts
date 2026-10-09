import { OperationError } from "@localman/operations";
import type { RequestHandler } from "express";

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

export interface CsrfGuardOptions {
	/** Exact origins (scheme://host[:port]) allowed to send mutations. */
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
		const origin = req.headers.origin;
		const fetchSite = req.headers["sec-fetch-site"];
		if ((origin && origins.has(origin)) || fetchSite === "same-origin") {
			next();
			return;
		}
		next(
			new OperationError(403, "CSRF_REJECTED", "Cross-site request rejected"),
		);
	};
}
