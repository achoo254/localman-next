import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import { getDbState } from "../db/connect-mongo.js";
import type { Logger } from "../logger.js";
import { createErrorHandler, notFoundHandler } from "./error-handler.js";

export const JSON_BODY_LIMIT = "100kb";

/** A route that needs a larger JSON body than `JSON_BODY_LIMIT`. */
export interface RouteBodyLimit {
	readonly method: "post" | "put" | "patch" | "delete";
	/** Express path, e.g. `/api/v1/items/:id/data`. */
	readonly path: string;
	/** Bytes. */
	readonly limit: number;
	/**
	 * Checks that must pass before the large body is read (e.g. "signed
	 * in"), so an anonymous caller cannot make the server parse megabytes.
	 */
	readonly before?: readonly RequestHandler[];
}

export interface BaseAppOptions {
	readonly logger: Logger;
	/** Express `trust proxy` (see TRUST_PROXY); off when absent. */
	readonly trustProxy?: boolean | number | string;
	/** Runs before body parsing, e.g. a CSRF guard that must not parse forgeries. */
	readonly beforeBody?: readonly RequestHandler[];
	/**
	 * Per-route JSON parsers mounted after `beforeBody` and before the
	 * default one, which then skips the already parsed body. Every other
	 * route keeps `JSON_BODY_LIMIT`.
	 */
	readonly routeBodyLimits?: readonly RouteBodyLimit[];
	/** Registers the server-specific routes between middleware and fallbacks. */
	readonly mountRoutes?: (app: Express) => void;
}

/**
 * Shared shell of both HTTP servers: security headers, JSON body limit,
 * `/healthz`, 404 and the error handler.
 */
export function createBaseApp({
	logger,
	trustProxy = false,
	beforeBody = [],
	routeBodyLimits = [],
	mountRoutes,
}: BaseAppOptions): Express {
	const app = express();
	app.disable("x-powered-by");
	app.set("trust proxy", trustProxy);
	app.use(helmet());
	for (const middleware of beforeBody) app.use(middleware);
	for (const { method, path, limit, before = [] } of routeBodyLimits) {
		app[method](path, ...before, express.json({ limit }));
	}
	app.use(express.json({ limit: JSON_BODY_LIMIT }));

	// Liveness only: stays 200 while MongoDB is down; `db` reports its state.
	app.get("/healthz", (_req, res) => {
		res.status(200).json({ status: "ok", db: getDbState() });
	});

	mountRoutes?.(app);
	app.use(notFoundHandler);
	app.use(createErrorHandler(logger));
	return app;
}
