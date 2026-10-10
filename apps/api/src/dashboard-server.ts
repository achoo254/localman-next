import {
	type AnyOperation,
	LOWERCASE_METHOD,
	OperationError,
	type OperationRouterOptions,
	buildOpenApiDocument,
	createOperationRouter,
} from "@localman/operations";
import type { Express, RequestHandler, Router } from "express";
import { type RouteBodyLimit, createBaseApp } from "./http/create-base-app.js";
import { createCsrfGuard } from "./http/csrf-guard.js";
import { noStore } from "./http/no-store.js";
import {
	type SessionAuthenticator,
	createSessionAuthResolver,
} from "./http/require-auth.js";
import type { Logger } from "./logger.js";
import { createLogStreamRouter } from "./modules/mock-runtime/log-stream-routes.js";
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
	/**
	 * Localman MCP (`/mcp` and its OAuth metadata). It authenticates with
	 * Bearer tokens only and reads its own body, so it runs before the CSRF
	 * guard and the JSON parsers; other paths pass through.
	 */
	readonly mcp?: RequestHandler;
}

const anonymous: OperationRouterOptions["resolveAuth"] = () => null;

/** 401 before a large body is read, for operations that need a caller. */
function signedInBeforeBody(
	resolveAuth: OperationRouterOptions["resolveAuth"],
): RequestHandler {
	return async (req, _res, next) => {
		if (!(await resolveAuth(req))) {
			throw new OperationError(
				401,
				"UNAUTHENTICATED",
				"Authentication required",
			);
		}
		next();
	};
}

/**
 * Larger body parsers for the operations that declare `bodyLimit`. Scoped
 * operations resolve the session first (the router resolves it again,
 * which costs one session lookup), so anonymous callers get 401 unread.
 */
function bodyLimitsOf(
	operations: readonly AnyOperation[],
	resolveAuth: OperationRouterOptions["resolveAuth"],
): RouteBodyLimit[] {
	return operations.flatMap((op) =>
		op.bodyLimit === undefined || op.method === "GET"
			? []
			: [
					{
						method: LOWERCASE_METHOD[op.method],
						path: `${API_PREFIX}${op.path}`,
						limit: op.bodyLimit,
						before:
							op.scopes.length > 0 ? [signedInBeforeBody(resolveAuth)] : [],
					},
				],
	);
}

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
	const resolveAuth = auth
		? createSessionAuthResolver(auth.authenticate)
		: anonymous;
	const router = createOperationRouter(operations, { resolveAuth });

	return createBaseApp({
		logger: options.logger,
		trustProxy: options.trustProxy,
		beforeBody: [
			...(options.mcp ? [options.mcp] : []),
			createCsrfGuard({
				allowedOrigins: options.allowedOrigins,
				exempt: auth?.csrfExempt,
			}),
		],
		routeBodyLimits: bodyLimitsOf(operations, resolveAuth),
		mountRoutes: (app) => {
			if (auth) app.use(auth.router);
			app.get(`${API_PREFIX}/openapi.json`, (_req, res) => {
				res.json(openApi);
			});
			// Live request log (SSE), before the operation router's 404.
			app.use(createLogStreamRouter({ resolveAuth }));
			// API answers are per user: never let a browser or proxy cache them.
			app.use(API_PREFIX, noStore, router);
		},
	});
}
