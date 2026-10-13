import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express, {
	type Express,
	type NextFunction,
	type Request,
	type Response,
	Router,
} from "express";
import type pino from "pino";
import { createAuthRouter } from "./auth-routes.js";
import { describeError } from "./oidc-errors.js";
import { createPageRouter } from "./page-routes.js";
import {
	type TenantWebSettings,
	tenantWebConsoles,
} from "./tenant-web-consoles.js";
import {
	type WebConfig,
	type WebConfigDefaults,
	loadWebConfig,
} from "./web-config.js";
import { type WebContextOptions, createWebContext } from "./web-context.js";

export const CONTENT_SECURITY_POLICY =
	"default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'";

/**
 * `static/` next to the bundle (`dist/tunelo-server/server.mjs`) in
 * production, or at the package root when running from `src/`.
 */
function findStaticDir(): string | null {
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [join(here, "static"), join(here, "..", "..", "static")];
	return candidates.find((dir) => existsSync(join(dir, "css"))) ?? null;
}

/** `/`, `/lang`, `/auth/*`, `/assets/*`; case-insensitive like Express routes. */
const CONSOLE_PATH = /^\/(?:lang\/?|auth\/.*|assets\/.*)?$/i;

/** HTTP status of a client error raised by middleware (body too large...). */
function clientErrorStatus(error: unknown): number | null {
	const status = (error as { status?: unknown } | null)?.status;
	return typeof status === "number" && status >= 400 && status < 500
		? status
		: null;
}

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
	res.set({
		"content-security-policy": CONTENT_SECURITY_POLICY,
		"x-content-type-options": "nosniff",
		"referrer-policy": "no-referrer",
	});
	next();
}

/**
 * The web console: `/`, `/lang`, `/auth/*` and `/assets/*` on the public
 * host only. Requests for other hosts (the old apex domain) and other paths
 * fall through to the routes mounted after it, unchanged.
 */
export function createWebConsole(options: WebContextOptions): Router {
	const ctx = createWebContext(options);
	const publicHost = new URL(options.config.publicUrl).host;
	const staticDir = findStaticDir();
	if (!staticDir) {
		options.logger.error("Web console assets not found; pages render unstyled");
	}

	const router = Router();
	router.use((req, _res, next) => {
		const mine =
			req.headers.host?.toLowerCase() === publicHost &&
			CONSOLE_PATH.test(req.path);
		next(mine ? undefined : "router");
	});
	router.use(securityHeaders);
	if (staticDir) {
		router.use(
			"/assets",
			express.static(staticDir, { index: false, maxAge: "1h" }),
		);
	}
	router.use("/assets", (_req, res) => {
		res.status(404).type("text/plain").send("Not found");
	});
	router.use(createPageRouter(ctx));
	router.use(createAuthRouter(ctx));
	router.use(
		(error: unknown, _req: Request, res: Response, _next: NextFunction) => {
			if (res.headersSent) return;
			const status = clientErrorStatus(error);
			if (status !== null) {
				res.status(status).type("text/plain").send("Bad request");
				return;
			}
			ctx.logger.error({ err: describeError(error) }, "Web console error");
			res.status(500).type("text/plain").send("Something went wrong.");
		},
	);
	return router;
}

/**
 * Mounts the console on `app` when it is configured, for the primary
 * tenant and, with `tenants`, for every other tenant's domain. Never
 * throws: the console is optional, so a bad setting or a setup error is
 * logged (names, never values) and the API, relay, /login and WebSockets
 * start as before.
 */
export function mountWebConsole(
	app: Express,
	env: NodeJS.ProcessEnv,
	defaults: WebConfigDefaults,
	logger: pino.Logger,
	tenants?: TenantWebSettings,
): boolean {
	try {
		const primary = primaryConsoleFromEnv(env, defaults, logger);
		if (!primary) return false;
		app.use(tenantWebConsoles({ primary, tenants, logger }));
		return true;
	} catch (error) {
		logger.error(
			{ err: describeError(error) },
			"Web console setup failed; console disabled",
		);
		return false;
	}
}

/**
 * The console from the environment, or `null` (logged by variable name,
 * never by value) when it is not configured: the server then runs as before.
 */
export function webConsoleFromEnv(
	env: NodeJS.ProcessEnv,
	defaults: WebConfigDefaults,
	logger: pino.Logger,
): Router | null {
	return primaryConsoleFromEnv(env, defaults, logger)?.router ?? null;
}

function primaryConsoleFromEnv(
	env: NodeJS.ProcessEnv,
	defaults: WebConfigDefaults,
	logger: pino.Logger,
): { router: Router; config: WebConfig } | null {
	const result = loadWebConfig(env, defaults);
	if (!result.enabled) {
		logger.warn(
			{ missing: result.missing, invalid: result.invalid },
			"Web console disabled",
		);
		return null;
	}
	logger.info(
		{ publicUrl: result.config.publicUrl, clientId: result.config.clientId },
		"Web console enabled",
	);
	const router = createWebConsole({
		config: result.config,
		logger,
		tunnelDomain: defaults.primaryDomain,
	});
	return { router, config: result.config };
}
