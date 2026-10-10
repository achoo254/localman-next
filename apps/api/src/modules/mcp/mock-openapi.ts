import {
	DEFAULT_RESPONSE,
	MAX_PAGE_LIMIT,
	MOCK_QUERY_PARAMS,
	MOCK_TOOL_ENDPOINTS,
	type MockToolAction,
	type MockToolEntry,
	mockToolEntries,
	resourceParentKey,
} from "@localman/shared";
import { collectionPath } from "./mock-api-paths.js";
import type { MockApiResource } from "./mock-mcp-tools-cache.js";
import {
	ERROR_SCHEMA,
	type SchemaObject,
	recordInputSchema,
	recordSchema,
	refTo,
} from "./mock-openapi-schemas.js";
import type { ToolShape } from "./mock-tool-fields.js";

type Json = Readonly<Record<string, unknown>>;

export interface MockOpenApiInput {
	readonly title: string;
	/** `https://{secret}.{domain}{prefix}`: paths are relative to it. */
	readonly serverUrl: string;
	readonly resources: readonly MockApiResource[];
}

const [SEARCH] = MOCK_QUERY_PARAMS.search;
const [PAGE] = MOCK_QUERY_PARAMS.page;
const [LIMIT] = MOCK_QUERY_PARAMS.limit;
const [SORT_BY] = MOCK_QUERY_PARAMS.sort;
const [ORDER] = MOCK_QUERY_PARAMS.order;

const LIST_QUERY: readonly Json[] = [
	{
		name: SEARCH,
		in: "query",
		schema: { type: "string" },
		description: "Case-insensitive text in any top-level string value",
	},
	{
		name: SORT_BY,
		in: "query",
		schema: { type: "string" },
		description: "Field to sort by",
	},
	{
		name: ORDER,
		in: "query",
		schema: { type: "string", enum: ["asc", "desc"] },
	},
	{ name: PAGE, in: "query", schema: { type: "integer", minimum: 1 } },
	{
		name: LIMIT,
		in: "query",
		schema: { type: "integer", minimum: 1, maximum: MAX_PAGE_LIMIT },
	},
];

const ERROR_RESPONSES: Json = {
	"400": { $ref: "#/components/responses/Error" },
	"404": { $ref: "#/components/responses/NotFound" },
	"429": { $ref: "#/components/responses/Error" },
};

function jsonContent(schema: SchemaObject): Json {
	return { "application/json": { schema } };
}

/** The 2xx response: the data, or whatever the endpoint's template renders. */
function success(
	entry: MockToolEntry<MockApiResource>,
	data: SchemaObject,
): Json {
	const { method, path } = MOCK_TOOL_ENDPOINTS[entry.action];
	const endpoint = entry.resource.endpoints.find(
		(candidate) => candidate.method === method && candidate.path === path,
	);
	const custom =
		endpoint !== undefined && endpoint.response !== DEFAULT_RESPONSE;
	return custom
		? {
				description: "Custom response template, rendered per request",
				content: jsonContent({}),
			}
		: { description: "Success", content: jsonContent(data) };
}

function shapeOf(entry: MockToolEntry<MockApiResource>): ToolShape {
	const parent = entry.ancestors.at(-1);
	return {
		schema: entry.resource.schema,
		template: entry.resource.template,
		parentKey: parent ? resourceParentKey(entry.resource, parent.name) : null,
		parentName: parent?.name ?? null,
	};
}

const VERBS: Readonly<Record<MockToolAction, string>> = {
	list: "List",
	get: "Get one",
	create: "Create",
	update: "Update (merge)",
	delete: "Delete (with nested records)",
};

/** `get`/`post`/… operations of one enabled endpoint, keyed by method. */
function operationsOf(
	entry: MockToolEntry<MockApiResource>,
	slug: string,
	pathParams: readonly string[],
): Record<string, Json> {
	const { action, name } = entry;
	const record = refTo(slug);
	const one = action !== "list" && action !== "create";
	const parameters = [
		...[...pathParams, ...(one ? ["id"] : [])].map((param) => ({
			name: param,
			in: "path",
			required: true,
			schema: { type: "string" },
		})),
		...(action === "list" ? LIST_QUERY : []),
	];
	const body = { required: false, content: jsonContent(refTo(`${slug}Input`)) };
	const operation = (operationId: string): Json => ({
		operationId,
		summary: `${VERBS[action]} ${entry.resource.name}`,
		tags: [entry.resource.name],
		parameters,
		...(action === "create" || action === "update"
			? { requestBody: body }
			: {}),
		responses: {
			[action === "create" ? "201" : "200"]: success(
				entry,
				action === "list" ? { type: "array", items: record } : record,
			),
			...ERROR_RESPONSES,
		},
	});
	if (action === "update") {
		return { put: operation(name), patch: operation(`patch_${slug}`) };
	}
	return {
		[MOCK_TOOL_ENDPOINTS[action].method.toLowerCase()]: operation(name),
	};
}

/**
 * OpenAPI 3.1 document of a project's REST mock: one path per enabled
 * endpoint, on the nested routes the MCP tools address, with record
 * schemas from each resource's schema or object template. Operation ids
 * are the MCP tool names (PATCH gets `patch_<res>`). Pure.
 */
export function buildMockOpenApi(input: MockOpenApiInput): Json {
	const paths: Record<string, Record<string, Json>> = {};
	const schemas: Record<string, SchemaObject> = { Error: ERROR_SCHEMA };
	for (const entry of mockToolEntries(input.resources)) {
		const slug = entry.name.slice(entry.action.length + 1);
		const route = collectionPath([...entry.ancestors, entry.resource]);
		const one =
			entry.action === "list" || entry.action === "create" ? "" : "/{id}";
		const shape = shapeOf(entry);
		schemas[slug] ??= recordSchema(shape);
		schemas[`${slug}Input`] ??= recordInputSchema(shape);
		const key = `${route.path}${one}`;
		paths[key] = { ...paths[key], ...operationsOf(entry, slug, route.params) };
	}
	return {
		openapi: "3.1.0",
		info: {
			title: input.title,
			version: "1.0.0",
			description:
				"REST mock generated by Localman from the project's resources. Only enabled endpoints are listed.",
		},
		servers: [{ url: input.serverUrl }],
		paths,
		components: {
			schemas,
			responses: {
				Error: { description: "Error", content: jsonContent(refTo("Error")) },
				NotFound: {
					description: 'The JSON string "Not found"',
					content: jsonContent({ type: "string" }),
				},
			},
		},
	};
}
