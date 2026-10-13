import { type AnyOperation, OperationError } from "@localman/operations";
import {
	type AuthInfo,
	type McpServer,
	createMcpHandler,
} from "@modelcontextprotocol/server";
import { type Request, Router } from "express";
import { USER_SCOPE } from "../../http/require-auth.js";
import type { Logger } from "../../logger.js";
import { operations as registeredOperations } from "../../operations/registry.js";
import { createConfirmTokenService } from "./confirm-token.js";
import {
	type McpCallerContext,
	baseScopesOf,
	callerExtra,
	callerOf,
	oauthReachableOperations,
	toolsetsOpenedBy,
} from "./localman-mcp-access.js";
import {
	SubscriptionSlots,
	ensureKnownSubject,
	takeMcpRequestSlot,
} from "./localman-mcp-limits.js";
import type { AccessTokenKeys } from "./mcp-access-token.js";
import {
	readMcpBody,
	sendFetchResponse,
	toFetchRequest,
} from "./mcp-fetch-bridge.js";
import type { McpHandlerRegistry } from "./mcp-handler-registry.js";
import { jsonBodyOf, jsonRpcCallOf, refuseBatch } from "./mcp-json-rpc.js";
import {
	MCP_PATH,
	type McpResourceSettings,
	authenticateBearer,
	mcpResourceUrlOf,
	refuseInsufficientScope,
	registerResourceMetadataRoutes,
	resourceMetadataUrlOf,
} from "./mcp-resource-metadata.js";
import { tenantMcpSettings } from "./mcp-tenant-settings.js";
import { createOperationMcpServer } from "./operation-mcp-server.js";
import { PrincipalEventBus } from "./principal-event-bus.js";
import {
	createMemoryToolsetSelectionStore,
	parseToolsetsParam,
} from "./toolset-selection.js";

const SERVER_INFO = { name: "localman", version: "1.0.0" };

export interface LocalmanMcpOptions {
	/** `PUBLIC_URL`: the resource is `{PUBLIC_URL}/mcp`. */
	/** The primary tenant's dashboard origin (others follow their domain). */
	readonly publicUrl: string;
	/** `OIDC_ISSUER`, advertised as the authorization server. */
	readonly issuer: string;
	/** Issuer and JWKS the access tokens are verified against. */
	readonly keys: AccessTokenKeys;
	/** Browser origins allowed to call `/mcp` (others get 403). */
	readonly allowedOrigins: readonly string[];
	readonly logger: Logger;
	readonly operations?: readonly AnyOperation[];
	/** Closes the handler (and its open streams) at shutdown. */
	readonly handlers?: McpHandlerRegistry;
}

/** Toolset choices and notifications are per user and OAuth client. */
const principalKeyOf = (subject: string, clientId: string): string =>
	`${subject} ${clientId}`;

function assertAllowedOrigin(
	req: Request,
	allowed: ReadonlySet<string>,
	tenantOrigin: string,
) {
	const origin = req.headers.origin;
	if (origin === undefined || allowed.has(origin) || origin === tenantOrigin) {
		return;
	}
	throw new OperationError(
		403,
		"ORIGIN_REJECTED",
		"Cross-origin MCP requests are not accepted",
	);
}

/**
 * Localman MCP for AI coding agents: `/mcp` over Streamable HTTP, an OAuth
 * 2.1 resource server of the shared IdP, plus its Protected Resource
 * Metadata. Tools are the registry's operations of the toolsets the token
 * opens, run as the token's user through the same checks as REST. Only the
 * `Authorization: Bearer` header authenticates; the session cookie and
 * the CSRF guard play no part, so mount this before both. Each subject
 * has a request rate (`localmanMcpRateLimit`) and at most
 * `MAX_SUBSCRIPTIONS_PER_SUBJECT` open listen streams; a request carries
 * one JSON-RPC message (batches get 400).
 */
export function createLocalmanMcpRouter(options: LocalmanMcpOptions): Router {
	const { logger } = options;
	const reachable = oauthReachableOperations(
		options.operations ?? registeredOperations,
	);
	const settings = tenantMcpSettings({
		publicUrl: options.publicUrl,
		issuer: options.issuer,
		scopesSupported: baseScopesOf(reachable),
		keys: options.keys,
	});
	const origins = new Set(options.allowedOrigins);
	const selections = createMemoryToolsetSelectionStore();
	const confirmTokens = createConfirmTokenService();
	const subscriptions = new SubscriptionSlots();
	const bus = new PrincipalEventBus((error) =>
		logger.warn({ err: error }, "MCP notification failed"),
	);

	const buildServer = (authInfo: AuthInfo | undefined): McpServer => {
		const caller = callerOf(authInfo);
		const principalKey = principalKeyOf(
			caller.subjectId,
			authInfo?.clientId ?? "",
		);
		const scopes = authInfo?.scopes ?? [];
		const opened = toolsetsOpenedBy(scopes, reachable);
		return createOperationMcpServer({
			serverInfo: SERVER_INFO,
			operations: reachable.filter((op) => opened.has(op.toolset)),
			caller: {
				auth: { subjectId: caller.subjectId, scopes: [USER_SCOPE] },
				tokenScopes: scopes,
				clientIp: caller.clientIp,
			},
			toolsets: caller.toolsets,
			// Per user and OAuth client: two agents of one user choose apart.
			selection: { store: selections, principalKey },
			confirmTokens,
			logger,
			onToolsChanged: () =>
				bus.publishTo(principalKey, { kind: "tools_list_changed" }),
		});
	};
	const handler = createMcpHandler((ctx) => buildServer(ctx.authInfo), {
		bus,
		onerror: (error) => logger.warn({ err: error }, "MCP request failed"),
	});
	options.handlers?.track(handler);

	const router = Router();
	registerResourceMetadataRoutes(router, settings);
	router.all(MCP_PATH, async (req, res) => {
		options.handlers?.assertOpen();
		assertAllowedOrigin(req, origins, settings.publicUrl);
		const token = await authenticateBearer(req, res, settings);
		if (toolsetsOpenedBy(token.scopes, reachable).size === 0) {
			throw refuseInsufficientScope(res, settings, settings.scopesSupported);
		}
		await takeMcpRequestSlot(token.subject, res);
		const toolsets = parseToolsetsParam(req.query.toolsets);
		await ensureKnownSubject(token.subject);
		const caller: McpCallerContext = {
			subjectId: token.subject,
			clientIp: req.ip ?? null,
			toolsets,
		};
		const authInfo: AuthInfo = {
			token: token.token,
			clientId: token.clientId,
			scopes: [...token.scopes],
			expiresAt: token.expiresAt,
			resource: new URL(mcpResourceUrlOf(settings.publicUrl)),
			resourceMetadataUrl: resourceMetadataUrlOf(settings.publicUrl),
			extra: callerExtra(caller),
		};
		const body = await readMcpBody(req);
		const message = jsonBodyOf(body);
		if (refuseBatch(res, message)) return;
		const call = jsonRpcCallOf(message);
		if (!subscriptions.holdFor(token.subject, call, res)) return;
		// Answers are per user; tools/list also says `cacheScope: private`.
		res.set("Cache-Control", "no-store");
		const abort = new AbortController();
		res.once("close", () => abort.abort());
		const url = new URL(req.originalUrl, settings.publicUrl).href;
		const request = await toFetchRequest(req, url, abort.signal, body);
		// Shutdown may have closed the handler while this request was
		// authenticated: refuse it (503) rather than serve it half-closed.
		options.handlers?.assertOpen();
		const principal = principalKeyOf(token.subject, token.clientId);
		const parsed = message === undefined ? {} : { parsedBody: message };
		const response = await bus.runAs(principal, () =>
			handler.fetch(request, { authInfo, ...parsed }),
		);
		await sendFetchResponse(response, res);
	});
	return router;
}
