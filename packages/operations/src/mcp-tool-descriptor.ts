import { type JsonSchema, toInputJsonSchema } from "./json-schema.js";
import type { AnyOperation, Toolset } from "./types.js";

export interface McpToolDescriptor {
	readonly name: string;
	readonly description: string;
	readonly inputSchema: JsonSchema;
	readonly annotations: {
		readonly readOnlyHint: boolean;
		readonly destructiveHint: boolean;
		readonly idempotentHint: boolean;
	};
	readonly toolset: Toolset;
	/** The MCP server must offer a dry run and confirm token for this tool. */
	readonly dryRun: boolean;
}

/** `mock.listResources` -> `list_resources`. */
export function toolNameOf(operationId: string): string {
	const action = operationId.slice(operationId.indexOf(".") + 1);
	return action.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** Text an agent reads to decide when to call the tool. */
export function toolDescriptionOf(op: {
	readonly summary?: unknown;
	readonly description?: unknown;
}): string {
	const parts = [op.summary, op.description].filter(
		(part): part is string => typeof part === "string" && part.trim() !== "",
	);
	return parts.join("\n\n");
}

/** Returns `null` for operations exempt from MCP. */
export function toMcpToolDescriptor(
	op: AnyOperation,
): McpToolDescriptor | null {
	if (op.mcp !== true) return null;
	return {
		name: toolNameOf(op.id),
		description: toolDescriptionOf(op),
		inputSchema: toInputJsonSchema(op.input),
		annotations: {
			readOnlyHint: op.annotations.readOnly,
			destructiveHint: op.annotations.destructive,
			idempotentHint: op.annotations.idempotent,
		},
		toolset: op.toolset,
		dryRun: op.dryRun,
	};
}
