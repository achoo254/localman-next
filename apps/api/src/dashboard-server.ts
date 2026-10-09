import {
	type AnyOperation,
	type OperationRouterOptions,
	buildOpenApiDocument,
	createOperationRouter,
} from "@localman/operations";
import type { Express, Router } from "express";
import { createBaseApp } from "./http/create-base-app.js";
import { createCsrfGuard } from "./http/csrf-guard.js";
import { noStore } from "./http/no-store.js";
import {
	type SessionAuthenticator,
	createSessionAuthResolver,
} from "./http/require-auth.js";
import type { Logger } from "./logger.js";
import { operations as registeredOperations } from "./operations/registry.js";

export const API_PREFIX = "/api/v1";

/** What the dashboard needs from the auth module (see auth-module.ts). */
export interface DashboardAuth {
	readonly router: Router;
	readonly authenticate: SessionAuthenticator;
	/** `METHOD path` pairs authenticated otherwise, exempt from CSRF. */
	readonly csrfExempt: readonly string[];
}

export interface DashboardAppOptions {
	readonly logger: Logger;
	/** Origins (scheme://host[:port]) allowed to send mutations (CSRF). */
	readonly allowedOrigins: readonly string[];
	readonly operations?: readonly AnyOperation[];
	/** Express `trust proxy`, so per-IP limits see the real client. */
	readonly trustProxy?: boolean | number | string;
	/** Sign-in routes and session lookup; without it every caller is anonymous. */
	readonly auth?: DashboardAuth;
}

const anonymous: OperationRouterOptions["resolveAuth"] = () => null;

/** Dashboard API (port 4000). Building the app never opens a socket. */
export function createDashboardApp(options: DashboardAppOptions): Express {
	const { auth } = options;
	const operations = options.operations ?? registeredOperations;
	// Built once so a schema without a JSON form fails at startup.
	const openApi = buildOpenApiDocument(
		operations,
		{ title: "Localman API", version: "1.0.0" },
		[{ url: API_PREFIX }],
	);
	const router = createOperationRouter(operations, {
		resolveAuth: auth
			? createSessionAuthResolver(auth.authenticate)
			: anonymous,
	});

	return createBaseApp({
		logger: options.logger,
		trustProxy: options.trustProxy,
		beforeBody: [
			createCsrfGuard({
				allowedOrigins: options.allowedOrigins,
				exempt: auth?.csrfExempt,
			}),
		],
		mountRoutes: (app) => {
			if (auth) app.use(auth.router);
			app.get(`${API_PREFIX}/openapi.json`, (_req, res) => {
				res.json(openApi);
			});
			// API answers are per user: never let a browser or proxy cache them.
			app.use(API_PREFIX, noStore, router);
		},
	});
}
