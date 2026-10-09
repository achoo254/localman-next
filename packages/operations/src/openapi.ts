import {
	type JsonSchema,
	toInputJsonSchema,
	toOutputJsonSchema,
} from "./json-schema.js";
import { toolNameOf } from "./mcp-tool-descriptor.js";
import { pathParamNames, toOpenApiPath } from "./operation-path.js";
import {
	type AnyOperation,
	DRY_RUN_QUERY_PARAM,
	type HttpMethod,
	LOWERCASE_METHOD,
} from "./types.js";

export interface OpenApiInfo {
	readonly title: string;
	readonly version: string;
	readonly description?: string;
}

export interface OpenApiServer {
	readonly url: string;
	readonly description?: string;
}

interface OpenApiParameter {
	name: string;
	in: "path" | "query";
	required: boolean;
	schema: JsonSchema;
}

export interface OpenApiOperation {
	operationId: string;
	summary?: string;
	description?: string;
	tags: string[];
	parameters?: OpenApiParameter[];
	requestBody?: { required: boolean; content: Record<string, unknown> };
	responses: Record<string, unknown>;
	"x-scopes": readonly string[];
	"x-mcp":
		| { tool: string; toolset: string; dryRun: boolean }
		| { exempt: string };
}

export interface OpenApiDocument {
	openapi: "3.1.0";
	info: OpenApiInfo;
	servers?: OpenApiServer[];
	paths: Record<
		string,
		Partial<Record<Lowercase<HttpMethod>, OpenApiOperation>>
	>;
	components: { schemas: Record<string, JsonSchema> };
}

const BODY_METHODS: ReadonlySet<HttpMethod> = new Set(["POST", "PUT", "PATCH"]);
const ERROR_REF = { $ref: "#/components/schemas/Error" };

const ERROR_SCHEMA: JsonSchema = {
	type: "object",
	required: ["error"],
	properties: {
		error: {
			type: "object",
			required: ["code", "message"],
			properties: {
				code: { type: "string" },
				message: { type: "string" },
				details: {
					oneOf: [
						{
							description: "Validation issues",
							type: "array",
							items: {
								type: "object",
								required: ["path", "message"],
								properties: {
									path: { type: "string" },
									message: { type: "string" },
								},
							},
						},
						{
							description:
								"Structured facts of a domain error, e.g. the plan limit reached",
							type: "object",
						},
					],
				},
			},
		},
	},
};

function errorResponse(description: string): Record<string, unknown> {
	return {
		description,
		content: { "application/json": { schema: ERROR_REF } },
	};
}

function buildOperation(op: AnyOperation): OpenApiOperation {
	const inputSchema = toInputJsonSchema(op.input);
	const properties = inputSchema.properties ?? {};
	const required = new Set(inputSchema.required ?? []);
	const pathParams = new Set(pathParamNames(op.path));
	const usesBody = BODY_METHODS.has(op.method);

	const parameters: OpenApiParameter[] = [];
	const bodyProperties: Record<string, JsonSchema> = {};
	for (const [name, schema] of Object.entries(properties)) {
		if (typeof schema !== "object") continue;
		if (pathParams.has(name)) {
			parameters.push({ name, in: "path", required: true, schema });
		} else if (usesBody) {
			bodyProperties[name] = schema;
		} else {
			parameters.push({
				name,
				in: "query",
				required: required.has(name),
				schema,
			});
		}
	}
	if (op.dryRun) {
		parameters.push({
			name: DRY_RUN_QUERY_PARAM,
			in: "query",
			required: false,
			schema: { type: "boolean", default: false },
		});
	}

	const bodyNames = Object.keys(bodyProperties);
	const bodyRequired = bodyNames.filter((name) => required.has(name));
	const responses: Record<string, unknown> = {
		[String(op.successStatus)]: {
			description: "Success",
			content: {
				"application/json": { schema: toOutputJsonSchema(op.output) },
			},
		},
		"400": errorResponse("Invalid input"),
		"500": errorResponse("Unexpected server error"),
	};
	if (op.scopes.length > 0) {
		responses["401"] = errorResponse("Authentication required");
		responses["403"] = errorResponse("Missing scope or denied by policy");
	} else if (op.policy) {
		responses["403"] = errorResponse("Denied by policy");
	}

	return {
		operationId: op.id,
		...(op.summary ? { summary: op.summary } : {}),
		...(op.description ? { description: op.description } : {}),
		tags: [op.toolset],
		...(parameters.length > 0 ? { parameters } : {}),
		...(bodyNames.length > 0
			? {
					requestBody: {
						required: bodyRequired.length > 0,
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: bodyProperties,
									...(bodyRequired.length > 0
										? { required: bodyRequired }
										: {}),
								},
							},
						},
					},
				}
			: {}),
		responses,
		"x-scopes": op.scopes,
		"x-mcp":
			op.mcp === true
				? { tool: toolNameOf(op.id), toolset: op.toolset, dryRun: op.dryRun }
				: { exempt: op.mcp.exempt },
	};
}

/** OpenAPI 3.1 document; paths are relative to the first server URL. */
export function buildOpenApiDocument(
	operations: readonly AnyOperation[],
	info: OpenApiInfo,
	servers: readonly OpenApiServer[] = [],
): OpenApiDocument {
	const paths: OpenApiDocument["paths"] = {};
	for (const op of operations) {
		const path = toOpenApiPath(op.path);
		const item = paths[path] ?? {};
		item[LOWERCASE_METHOD[op.method]] = buildOperation(op);
		paths[path] = item;
	}
	return {
		openapi: "3.1.0",
		info: { ...info },
		...(servers.length > 0 ? { servers: [...servers] } : {}),
		paths,
		components: { schemas: { Error: ERROR_SCHEMA } },
	};
}
