import { OperationError } from "@localman/operations";
import { MAX_JSON_BODY_KB } from "@localman/shared";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { requestIdOf } from "../../http/request-log.js";
import { closeSignal } from "../mock-runtime/mock-behavior-rest.js";
import { addressOf, maskSecret } from "../mock-runtime/mock-http.js";
import {
	type MockAddress,
	looksLikeMcp,
	resolveProject,
	stripPrefix,
} from "../mock-runtime/resolve-project.js";
import { mockBaseUrlOf } from "../projects/project-view.js";
import { loadResources } from "../resources/resource-store.js";
import { serveMcpRequest } from "./mcp-express-bridge.js";
import type { McpHandlerRegistry } from "./mcp-handler-registry.js";
import { admitMcpBearer } from "./mock-mcp-auth.js";
import { refuseListen, warnShadowedResource } from "./mock-mcp-guards.js";
import { registerMockDocuments } from "./mock-mcp-resources.js";
import {
	type MockApiResource,
	forgetMockTools,
	mockToolsFor,
	toMockApiResource,
} from "./mock-mcp-tools-cache.js";
import { mockToolInput } from "./mock-tool-args.js";
import {
	type MockToolDeps,
	type MockToolScope,
	callMockTool,
} from "./mock-tool-call.js";
import type { MockToolDefinition } from "./mock-tool-factory.js";

export interface MockMcpDeps extends MockToolDeps {
	/** Closes the live per-request handlers (open streams) at shutdown. */
	readonly handlers?: McpHandlerRegistry;
}

const SERVER_INFO = { name: "localman-mock", version: "1.0.0" } as const;
const INSTRUCTIONS =
	"Tools read and change the data of this Localman mock API; the REST API serves the same records at once. Nested resources take parentId, the id of the direct parent record. Read mock://schema for the resource tree and mock://openapi for the REST API.";

/** One request's view of the project's mock. */
interface MockMcpScope extends MockToolScope {
	readonly mockBaseUrl: string;
	readonly apiResources: readonly MockApiResource[];
	readonly tools: readonly MockToolDefinition[];
}

/**
 * The MCP server of one project's mock, built per HTTP request (the
 * transport is stateless): one tool per enabled endpoint of every
 * resource (`buildMockTools`) and the `mock://schema` and
 * `mock://openapi` resources. Tools and resources are declared even when
 * the project has none yet, so `tools/list` answers an empty list.
 */
export function createMockMcpServer(
	scope: MockMcpScope,
	deps: MockMcpDeps,
): McpServer {
	// The lists are fixed for the request: nothing to listen for.
	const server = new McpServer(SERVER_INFO, {
		capabilities: {
			tools: { listChanged: false },
			resources: { listChanged: false },
		},
		instructions: INSTRUCTIONS,
	});
	for (const tool of scope.tools) {
		server.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: mockToolInput(tool.inputSchema),
				annotations: { ...tool.annotations, openWorldHint: false },
			},
			(args) => callMockTool(tool, args, scope, deps),
		);
	}
	registerMockDocuments(server, {
		projectName: scope.project.name,
		mockBaseUrl: scope.mockBaseUrl,
		resources: scope.apiResources,
		tools: scope.tools,
	});
	return server;
}

/** Whether the path is exactly `{prefix}/mcp` of the project. */
function isMcpPath(address: MockAddress, prefix: string): boolean {
	return stripPrefix(address.segments, prefix)?.length === 1;
}

async function serve(
	req: Request,
	res: Response,
	next: NextFunction,
	address: MockAddress,
	deps: MockMcpDeps,
): Promise<void> {
	const { secret } = address;
	const project = await resolveProject(secret);
	if (!project) forgetMockTools(secret);
	if (!project || !isMcpPath(address, project.prefix)) {
		next();
		return;
	}
	// Read by the request log line.
	res.locals.projectId = project.id.toHexString();
	if (!(await admitMcpBearer(req, res, project.id))) return;
	if (refuseListen(req, res)) return;
	const resources = await loadResources(project.id);
	warnShadowedResource(resources, project, deps.logger);
	const apiResources = resources.map(toMockApiResource);
	const scope: MockMcpScope = {
		secret,
		clientIp: req.ip ?? null,
		project,
		signal: closeSignal(res),
		resources,
		apiResources,
		tools: mockToolsFor(secret, project.id.toHexString(), apiResources),
		mockBaseUrl: mockBaseUrlOf(secret, project.prefix),
	};
	deps.handlers?.assertOpen();
	const handler = createMcpHandler(() => createMockMcpServer(scope, deps), {
		maxRequestBodySize: MAX_JSON_BODY_KB * 1024,
	});
	const release = deps.handlers?.track(handler);
	try {
		await serveMcpRequest(req, res, handler);
	} finally {
		release?.();
		await handler.close();
	}
}

/**
 * Hosted Mock MCP: Streamable HTTP at `{prefix}/mcp` of every project,
 * on its host (`{secret}.{domain}`) and on `/m/{secret}`. Mounted before
 * the REST catch-all, so the endpoint wins over an older resource named
 * `mcp`; any other path, or an unknown secret, passes on to REST. Rate
 * limits and the JSON body limit ran before (as for REST); the optional
 * Bearer token is checked here. Unexpected failures are logged without
 * the path (it may hold the secret) and answer 500 without details.
 */
export function createMockMcpRouter(deps: MockMcpDeps): RequestHandler {
	return (req, res, next) => {
		const address = addressOf(req);
		if (!address || !looksLikeMcp(address)) {
			next();
			return;
		}
		serve(req, res, next, address, deps).catch((error: unknown) => {
			if (error instanceof OperationError) {
				next(error);
				return;
			}
			deps.logger.error(
				{
					err: error,
					secret: maskSecret(address.secret),
					requestId: requestIdOf(res),
				},
				"Mock MCP request failed",
			);
			if (res.headersSent) {
				res.end();
				return;
			}
			res
				.status(500)
				.json(
					new OperationError(
						500,
						"INTERNAL_ERROR",
						"Internal server error",
					).toBody(),
				);
		});
	};
}
