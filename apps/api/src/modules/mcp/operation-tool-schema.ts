import {
	type AnyOperation,
	type JsonSchema,
	type McpToolDescriptor,
	toMcpToolDescriptor,
} from "@localman/operations";
import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";

export const DRY_RUN_ARG = "dry_run";
export const CONFIRM_TOKEN_ARG = "confirm_token";

export type ToolArgs = Record<string, unknown>;

function isRecord(value: unknown): value is ToolArgs {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Advertises a JSON Schema as-is and leaves validation to the operation's
 * zod schema, so MCP and REST reject bad input with the same
 * `VALIDATION_ERROR` body.
 */
export function advertisedSchema(
	schema: JsonSchema,
): StandardSchemaWithJSON<ToolArgs> {
	return {
		"~standard": {
			version: 1,
			vendor: "localman-operations",
			validate: (value) =>
				isRecord(value)
					? { value }
					: { issues: [{ message: "Tool arguments must be a JSON object" }] },
			jsonSchema: { input: () => schema, output: () => schema },
		},
	};
}

function controlProperties(
	tool: McpToolDescriptor,
): Record<string, JsonSchema> {
	if (!tool.dryRun) return {};
	const dryRun: JsonSchema = {
		type: "boolean",
		description:
			"Preview only: report what would change without changing anything.",
	};
	if (!tool.requiresConfirmation) return { [DRY_RUN_ARG]: dryRun };
	return {
		[DRY_RUN_ARG]: dryRun,
		[CONFIRM_TOKEN_ARG]: {
			type: "string",
			description:
				"Token returned by the dry run with this exact input; required for the real call.",
		},
	};
}

function toolInputSchema(tool: McpToolDescriptor): JsonSchema {
	const controls = controlProperties(tool);
	const own = tool.inputSchema.properties ?? {};
	for (const name of Object.keys(controls)) {
		if (Object.hasOwn(own, name)) {
			throw new Error(
				`Operation "${tool.operationId}" input must not declare "${name}"`,
			);
		}
	}
	return { ...tool.inputSchema, properties: { ...own, ...controls } };
}

function toolDescription(tool: McpToolDescriptor): string {
	if (tool.requiresConfirmation) {
		return `${tool.description}\n\nDestructive: first call with ${DRY_RUN_ARG}=true to get a preview and a ${CONFIRM_TOKEN_ARG} (valid 5 minutes, once, for this exact input). After the user approves, call again with the same input and that ${CONFIRM_TOKEN_ARG}.`;
	}
	if (tool.dryRun) {
		return `${tool.description}\n\nSet ${DRY_RUN_ARG}=true to preview without changing anything.`;
	}
	return tool.description;
}

/** Everything about an operation's tool that does not depend on the caller. */
export interface PreparedOperationTool {
	readonly descriptor: McpToolDescriptor;
	readonly description: string;
	/** Operation input plus `dry_run`/`confirm_token` where supported. */
	readonly inputSchema: JsonSchema;
}

const prepared = new WeakMap<AnyOperation, PreparedOperationTool | null>();

/**
 * Tool definition of an operation, or `null` when it is exempt from MCP.
 * Cached per operation: servers are built per request, the JSON Schema
 * conversion only once.
 */
export function prepareOperationTool(
	op: AnyOperation,
): PreparedOperationTool | null {
	const cached = prepared.get(op);
	if (cached !== undefined) return cached;
	const descriptor = toMcpToolDescriptor(op);
	const tool = descriptor && {
		descriptor,
		description: toolDescription(descriptor),
		inputSchema: toolInputSchema(descriptor),
	};
	prepared.set(op, tool);
	return tool;
}
