import {
	type JsonSchema,
	toInputJsonSchema,
	toOutputJsonSchema,
} from "./json-schema.js";
import {
	type AnyOperation,
	CREDENTIALS_WRITE_SCOPE,
	type Toolset,
	scopeAreaOf,
} from "./types.js";

export interface McpToolDescriptor {
	readonly name: string;
	readonly operationId: string;
	readonly description: string;
	readonly inputSchema: JsonSchema;
	readonly outputSchema: JsonSchema;
	readonly annotations: {
		readonly readOnlyHint: boolean;
		readonly destructiveHint: boolean;
		readonly idempotentHint: boolean;
	};
	readonly toolset: Toolset;
	/**
	 * Every scope the MCP access token must carry: `<toolset>:read` or
	 * `<toolset>:write`, plus `credentials:write` for credential minting
	 * and the operation's `mcpScope` (e.g. `client:send`).
	 * The operation's own `scopes` are still checked against the caller.
	 */
	readonly scopes: readonly string[];
	/** The tool accepts `dry_run` (the operation supports a preview). */
	readonly dryRun: boolean;
	/**
	 * A real call needs the `confirm_token` returned by a `dry_run` call
	 * with the same input (operations declaring `requiresConfirmation`).
	 */
	readonly requiresConfirmation: boolean;
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

/** MCP token scopes a tool needs; see `McpToolDescriptor.scopes`. */
export function mcpScopesOf(
	op: Pick<
		AnyOperation,
		"toolset" | "annotations" | "createsCredential" | "mcpScope"
	>,
): string[] {
	const access = op.annotations.readOnly ? "read" : "write";
	const scopes = [`${scopeAreaOf(op.toolset)}:${access}`];
	if (op.createsCredential) scopes.push(CREDENTIALS_WRITE_SCOPE);
	if (op.mcpScope !== undefined) scopes.push(op.mcpScope);
	return scopes;
}

/** Returns `null` for operations exempt from MCP. */
export function toMcpToolDescriptor(
	op: AnyOperation,
): McpToolDescriptor | null {
	if (op.mcp !== true) return null;
	return {
		name: toolNameOf(op.id),
		operationId: op.id,
		description: toolDescriptionOf(op),
		inputSchema: toInputJsonSchema(op.input),
		outputSchema: toOutputJsonSchema(op.output),
		annotations: {
			readOnlyHint: op.annotations.readOnly,
			destructiveHint: op.annotations.destructive,
			idempotentHint: op.annotations.idempotent,
		},
		toolset: op.toolset,
		scopes: mcpScopesOf(op),
		dryRun: op.dryRun,
		requiresConfirmation: op.requiresConfirmation && op.dryRun,
	};
}
