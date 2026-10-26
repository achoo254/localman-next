import { join } from "node:path";
import { type Request, type Response, Router } from "express";
import { extractSubdomain } from "../request-relay.js";
import { html } from "./html.js";

/** Browser icon paths on the apex host, each a file in `static/icons/`. */
export const BRAND_ICON_FILES: Readonly<Record<string, string>> = {
	"/favicon.ico": "favicon.ico",
	"/icon.svg": "icon.svg",
	"/apple-touch-icon.png": "apple-touch-icon.png",
};

/** `<link>` tags for the Tunelo icons above (AI-drawn, see static/icons). */
export const BRAND_ICON_LINKS = html`<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">`;

/**
 * Serves the Tunelo favicon set on the apex host only. On a tunnel
 * subdomain every path belongs to the user's app, so those requests (and
 * any other path) pass through untouched.
 */
export function createBrandIconRouter(staticDir: string | null): Router {
	const router = Router();
	router.get(
		Object.keys(BRAND_ICON_FILES),
		(req: Request, res: Response, next) => {
			const file = BRAND_ICON_FILES[req.path];
			if (
				!staticDir ||
				!file ||
				extractSubdomain(req.headers.host ?? "") !== null
			) {
				next();
				return;
			}
			res.set("x-content-type-options", "nosniff");
			res.sendFile(
				join(staticDir, "icons", file),
				{ maxAge: "1d" },
				(error) => {
					if (error && !res.headersSent) next();
				},
			);
		},
	);
	return router;
}
