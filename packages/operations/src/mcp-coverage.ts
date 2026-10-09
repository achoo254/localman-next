import { z } from "zod";
import { toInputJsonSchema } from "./json-schema.js";
import { toolDescriptionOf } from "./mcp-tool-descriptor.js";
import {
	type OperationConflictCode,
	findOperationConflicts,
} from "./operation-conflicts.js";

export type McpViolationCode =
	| "MISSING_MCP"
	| "INVALID_MCP"
	| "EMPTY_EXEMPT_REASON"
	| "MISSING_DESCRIPTION"
	| "DESTRUCTIVE_WITHOUT_DRY_RUN"
	| "CONFIRMATION_WITHOUT_DRY_RUN"
	| "UNREPRESENTABLE_INPUT_SCHEMA"
	| OperationConflictCode;

export interface McpProblem {
	readonly code: McpViolationCode;
	readonly message: string;
}

export interface McpCoverageViolation extends McpProblem {
	readonly operationId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * MCP rules for one operation. Accepts untyped data because CI may load
 * registries that bypassed `defineOperation`.
 */
export function mcpProblemsOf(candidate: unknown): McpProblem[] {
	if (!isRecord(candidate)) {
		return [{ code: "INVALID_MCP", message: "operation is not an object" }];
	}
	const problems: McpProblem[] = [];
	const { mcp } = candidate;

	if (mcp === undefined) {
		problems.push({
			code: "MISSING_MCP",
			message: 'declare `mcp: true` or `mcp: { exempt: "<reason>" }`',
		});
	} else if (mcp === true) {
		if (toolDescriptionOf(candidate) === "") {
			problems.push({
				code: "MISSING_DESCRIPTION",
				message: "an MCP tool needs a summary or description",
			});
		}
		problems.push(...inputSchemaProblems(candidate.input));
	} else if (isRecord(mcp) && typeof mcp.exempt === "string") {
		if (mcp.exempt.trim() === "") {
			problems.push({
				code: "EMPTY_EXEMPT_REASON",
				message: "`mcp.exempt` must explain why there is no MCP tool",
			});
		}
	} else {
		problems.push({
			code: "INVALID_MCP",
			message: '`mcp` must be `true` or `{ exempt: "<reason>" }`',
		});
	}

	const annotations = candidate.annotations;
	if (
		isRecord(annotations) &&
		annotations.destructive === true &&
		candidate.dryRun !== true
	) {
		problems.push({
			code: "DESTRUCTIVE_WITHOUT_DRY_RUN",
			message: "destructive operations must set `dryRun: true`",
		});
	}
	// The confirm token comes from a dry run, so there must be one.
	if (candidate.requiresConfirmation === true && candidate.dryRun !== true) {
		problems.push({
			code: "CONFIRMATION_WITHOUT_DRY_RUN",
			message: "`requiresConfirmation` needs `dryRun: true`",
		});
	}
	return problems;
}

function inputSchemaProblems(input: unknown): McpProblem[] {
	if (!(input instanceof z.ZodType)) {
		return [
			{
				code: "UNREPRESENTABLE_INPUT_SCHEMA",
				message: "`input` is not a zod schema",
			},
		];
	}
	try {
		toInputJsonSchema(input);
		return [];
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		return [
			{
				code: "UNREPRESENTABLE_INPUT_SCHEMA",
				message: `input schema has no JSON Schema form: ${reason}`,
			},
		];
	}
}

function operationIdOf(candidate: unknown, index: number): string {
	if (isRecord(candidate) && typeof candidate.id === "string") {
		return candidate.id;
	}
	return `<operation #${index}>`;
}

function isConflictSubject(
	candidate: unknown,
): candidate is Parameters<typeof findOperationConflicts>[0][number] {
	return (
		isRecord(candidate) &&
		typeof candidate.id === "string" &&
		typeof candidate.method === "string" &&
		typeof candidate.path === "string"
	);
}

/** Every MCP coverage violation in a registry; empty when the registry is clean. */
export function findMcpCoverageViolations(
	operations: readonly unknown[],
): McpCoverageViolation[] {
	const violations: McpCoverageViolation[] = [];
	operations.forEach((candidate, index) => {
		const operationId = operationIdOf(candidate, index);
		for (const problem of mcpProblemsOf(candidate)) {
			violations.push({ operationId, ...problem });
		}
	});
	violations.push(
		...findOperationConflicts(operations.filter(isConflictSubject)),
	);
	return violations;
}
