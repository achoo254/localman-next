import { OperationError } from "@localman/operations";
import { type MockToolAction, RECORD_ID_MAX } from "@localman/shared";
import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import type { EndpointCall } from "../mock-runtime/mock-endpoints.js";
import type { MockToolDefinition } from "./mock-tool-factory.js";
import {
	DATA_ARG,
	PARENT_ID_ARG,
	RECORD_ID_ARG,
	type ToolInputSchema,
} from "./mock-tool-schemas.js";
import type { ToolArgs } from "./operation-tool-schema.js";

/** A mock tool call, read into what the REST endpoint takes. */
export interface MockToolCall {
	/** Direct parent record; `null` addresses the resource's flat route. */
	readonly parentId: string | null;
	readonly recordId: string | null;
	readonly call: EndpointCall;
}

function invalid(path: string, message: string): OperationError {
	return new OperationError(400, "VALIDATION_ERROR", `"${path}" ${message}`, [
		{ path, message },
	]);
}

/** A record id as a REST path segment carries it. */
function recordId(args: ToolArgs, name: string): string | null {
	const value = args[name];
	if (value === undefined) return null;
	if (
		typeof value !== "string" ||
		value === "" ||
		value.length > RECORD_ID_MAX
	) {
		throw invalid(
			name,
			`must be a non-empty string of at most ${RECORD_ID_MAX} characters`,
		);
	}
	return value;
}

/**
 * List arguments as REST query strings: the list's own parameters and
 * field filters alike, validated afterwards by `parseListQuery` exactly
 * like a query string (unsafe names answer `INVALID_QUERY`).
 */
function listQuery(args: ToolArgs): Record<string, string> {
	const query: Record<string, string> = {};
	for (const [name, value] of Object.entries(args)) {
		if (name === PARENT_ID_ARG) continue;
		if (typeof value === "string") query[name] = value;
		else if (typeof value === "boolean") query[name] = String(value);
		else if (typeof value === "number" && Number.isFinite(value)) {
			query[name] = String(value);
		} else {
			throw invalid(name, "must be a string, number or boolean");
		}
	}
	return query;
}

/** Arguments each non-list action takes; anything else is refused. */
const ALLOWED: Readonly<
	Record<Exclude<MockToolAction, "list">, readonly string[]>
> = {
	get: [PARENT_ID_ARG, RECORD_ID_ARG],
	delete: [PARENT_ID_ARG, RECORD_ID_ARG],
	create: [PARENT_ID_ARG, DATA_ARG],
	update: [PARENT_ID_ARG, RECORD_ID_ARG, DATA_ARG],
};

/**
 * Reads the arguments of a mock tool. The SDK leaves validation to the
 * server (`advertisedSchema`), so this enforces the advertised shape:
 * `parentId` only on nested resources (required to create), `id` on
 * record tools, `data` an object (checked like a REST body later).
 */
export function readToolArgs(
	tool: MockToolDefinition,
	args: ToolArgs,
): MockToolCall {
	const { action, parentChain } = tool.target;
	const nested = parentChain.length > 0;
	if (!nested && args[PARENT_ID_ARG] !== undefined) {
		throw invalid(PARENT_ID_ARG, "is only accepted by nested resources");
	}
	const parentId = recordId(args, PARENT_ID_ARG);
	if (action === "list") {
		return {
			parentId,
			recordId: null,
			call: { query: listQuery(args), body: undefined },
		};
	}
	const allowed = ALLOWED[action];
	const unknown = Object.keys(args).find((name) => !allowed.includes(name));
	if (unknown !== undefined)
		throw invalid(unknown, "is not an argument of this tool");
	if (action === "create" && nested && parentId === null) {
		throw invalid(PARENT_ID_ARG, "is required");
	}
	const id = action === "create" ? null : recordId(args, RECORD_ID_ARG);
	if (action !== "create" && id === null)
		throw invalid(RECORD_ID_ARG, "is required");
	const data = args[DATA_ARG];
	if (action === "update" && data === undefined)
		throw invalid(DATA_ARG, "is required");
	return { parentId, recordId: id, call: { query: {}, body: data ?? {} } };
}

/**
 * Advertises a mock tool's JSON Schema as-is; `readToolArgs` and the
 * REST code behind it validate, so MCP and REST refuse bad input with
 * the same error bodies. (`advertisedSchema` does the same for
 * operations, typed for zod's JSON Schema.)
 */
export function mockToolInput(
	schema: ToolInputSchema,
): StandardSchemaWithJSON<ToolArgs> {
	return {
		"~standard": {
			version: 1,
			vendor: "localman-mock",
			validate: (value) =>
				typeof value === "object" && value !== null && !Array.isArray(value)
					? { value: { ...value } }
					: { issues: [{ message: "Tool arguments must be a JSON object" }] },
			jsonSchema: {
				input: () => ({ ...schema }),
				output: () => ({ ...schema }),
			},
		},
	};
}
