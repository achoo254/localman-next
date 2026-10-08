import { toolNameOf } from "./mcp-tool-descriptor.js";
import type { AnyOperation } from "./types.js";

export type OperationConflictCode =
	| "DUPLICATE_OPERATION_ID"
	| "DUPLICATE_ROUTE"
	| "DUPLICATE_TOOL_NAME";

export interface OperationConflict {
	readonly operationId: string;
	readonly code: OperationConflictCode;
	readonly message: string;
}

type ConflictSubject = Pick<AnyOperation, "id" | "method" | "path" | "mcp">;

/**
 * Registry-wide uniqueness: ids, `METHOD path` pairs and MCP tool names.
 * Express would silently serve the first of two identical routes while
 * OpenAPI documented the last, so duplicates must fail loudly instead.
 */
export function findOperationConflicts(
	operations: readonly ConflictSubject[],
): OperationConflict[] {
	const conflicts: OperationConflict[] = [];
	const ids = new Set<string>();
	const routeOwners = new Map<string, string>();
	const toolOwners = new Map<string, string>();

	for (const op of operations) {
		if (ids.has(op.id)) {
			conflicts.push({
				operationId: op.id,
				code: "DUPLICATE_OPERATION_ID",
				message: "operation id is declared more than once",
			});
		}
		ids.add(op.id);

		const route = `${op.method} ${op.path}`;
		const routeOwner = routeOwners.get(route);
		if (routeOwner !== undefined) {
			conflicts.push({
				operationId: op.id,
				code: "DUPLICATE_ROUTE",
				message: `route "${route}" is already used by "${routeOwner}"`,
			});
		} else {
			routeOwners.set(route, op.id);
		}

		if (op.mcp !== true) continue;
		const toolName = toolNameOf(op.id);
		const toolOwner = toolOwners.get(toolName);
		if (toolOwner !== undefined && toolOwner !== op.id) {
			conflicts.push({
				operationId: op.id,
				code: "DUPLICATE_TOOL_NAME",
				message: `tool name "${toolName}" is already used by "${toolOwner}"`,
			});
		} else {
			toolOwners.set(toolName, op.id);
		}
	}
	return conflicts;
}

/** Throws one error listing every conflict; used when an app starts. */
export function assertNoOperationConflicts(
	operations: readonly ConflictSubject[],
): void {
	const conflicts = findOperationConflicts(operations);
	if (conflicts.length === 0) return;
	const lines = conflicts.map(
		(c) => `  - [${c.code}] ${c.operationId}: ${c.message}`,
	);
	throw new Error(`Operation registry has conflicts:\n${lines.join("\n")}`);
}
