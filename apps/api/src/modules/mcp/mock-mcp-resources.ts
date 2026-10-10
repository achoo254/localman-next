import { DEFAULT_RESPONSE, resourceParentKey } from "@localman/shared";
import type { McpServer } from "@modelcontextprotocol/server";
import { ancestorsOf, collectionPath } from "./mock-api-paths.js";
import type { MockApiResource } from "./mock-mcp-tools-cache.js";
import { buildMockOpenApi } from "./mock-openapi.js";
import type { MockToolDefinition } from "./mock-tool-factory.js";

export const SCHEMA_RESOURCE_URI = "mock://schema";
export const OPENAPI_RESOURCE_URI = "mock://openapi";

/** What the two documents describe. */
export interface MockDocumentsSource {
	readonly projectName: string;
	/** `https://{secret}.{domain}{prefix}`. */
	readonly mockBaseUrl: string;
	readonly resources: readonly MockApiResource[];
	readonly tools: readonly MockToolDefinition[];
}

/**
 * `mock://schema`: the resource tree with each resource's nested REST
 * route, schema or object template, endpoints (custom responses only
 * flagged, as MCP never applies them) and MCP tools.
 */
export function mockSchemaDocument(source: MockDocumentsSource) {
	const byId = new Map(source.resources.map((r) => [r.id, r]));
	return {
		mockBaseUrl: source.mockBaseUrl,
		mcpUrl: `${source.mockBaseUrl}/mcp`,
		resources: source.resources.map((resource) => {
			const ancestors = ancestorsOf(byId, resource);
			const parent = ancestors.at(-1);
			return {
				id: resource.id,
				name: resource.name,
				parentId: resource.parentId,
				path: collectionPath([...ancestors, resource]).path,
				parentKey:
					parent === undefined
						? null
						: resourceParentKey(resource, parent.name),
				schema: resource.schema,
				template: resource.template,
				endpoints: resource.endpoints.map((endpoint) => ({
					method: endpoint.method,
					path: endpoint.path,
					enabled: endpoint.enabled,
					customResponse: endpoint.response !== DEFAULT_RESPONSE,
				})),
				tools: source.tools
					.filter((tool) => tool.target.resourceId === resource.id)
					.map((tool) => tool.name),
			};
		}),
	};
}

function jsonContents(uri: URL, value: unknown) {
	return {
		contents: [
			{
				uri: uri.href,
				mimeType: "application/json",
				text: JSON.stringify(value),
			},
		],
	};
}

/** Registers `mock://schema` and `mock://openapi`, built on read. */
export function registerMockDocuments(
	server: McpServer,
	source: MockDocumentsSource,
): void {
	server.registerResource(
		"schema",
		SCHEMA_RESOURCE_URI,
		{
			title: "Mock resource tree and schemas",
			description:
				"Resources of this mock with their nested REST routes, schemas or object templates, endpoints and MCP tools.",
			mimeType: "application/json",
		},
		(uri) => jsonContents(uri, mockSchemaDocument(source)),
	);
	server.registerResource(
		"openapi",
		OPENAPI_RESOURCE_URI,
		{
			title: "OpenAPI 3.1 of the REST mock",
			description:
				"OpenAPI 3.1 document of this mock's enabled REST endpoints, generated from its resources.",
			mimeType: "application/json",
		},
		(uri) =>
			jsonContents(
				uri,
				buildMockOpenApi({
					title: source.projectName,
					serverUrl: source.mockBaseUrl,
					resources: source.resources,
				}),
			),
	);
}
