import {
	type AnyOperation,
	type OperationRouterOptions,
	buildOpenApiDocument,
	createOperationRouter,
} from "@localman/operations";
import type { Express } from "express";
import { createBaseApp } from "./http/create-base-app.js";
import type { Logger } from "./logger.js";
import { operations as registeredOperations } from "./operations/registry.js";

export const API_PREFIX = "/api/v1";

export interface DashboardAppOptions {
	readonly logger: Logger;
	readonly operations?: readonly AnyOperation[];
	readonly resolveAuth?: OperationRouterOptions["resolveAuth"];
}

// No authentication exists yet, so every scoped operation answers 401.
const anonymous: OperationRouterOptions["resolveAuth"] = () => null;

/** Dashboard API (port 4000). Building the app never opens a socket. */
export function createDashboardApp(options: DashboardAppOptions): Express {
	const operations = options.operations ?? registeredOperations;
	// Built once so a schema without a JSON form fails at startup.
	const openApi = buildOpenApiDocument(
		operations,
		{ title: "Localman API", version: "1.0.0" },
		[{ url: API_PREFIX }],
	);
	const router = createOperationRouter(operations, {
		resolveAuth: options.resolveAuth ?? anonymous,
	});

	return createBaseApp({
		logger: options.logger,
		mountRoutes: (app) => {
			app.get(`${API_PREFIX}/openapi.json`, (_req, res) => {
				res.json(openApi);
			});
			app.use(API_PREFIX, router);
		},
	});
}
