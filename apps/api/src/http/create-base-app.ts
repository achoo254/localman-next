import express, { type Express } from "express";
import helmet from "helmet";
import { getDbState } from "../db/connect-mongo.js";
import type { Logger } from "../logger.js";
import { createErrorHandler, notFoundHandler } from "./error-handler.js";

export const JSON_BODY_LIMIT = "100kb";

export interface BaseAppOptions {
	readonly logger: Logger;
	/** Registers the server-specific routes between middleware and fallbacks. */
	readonly mountRoutes?: (app: Express) => void;
}

/**
 * Shared shell of both HTTP servers: security headers, JSON body limit,
 * `/healthz`, 404 and the error handler.
 */
export function createBaseApp({
	logger,
	mountRoutes,
}: BaseAppOptions): Express {
	const app = express();
	app.disable("x-powered-by");
	app.use(helmet());
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
