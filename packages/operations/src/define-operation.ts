import { z } from "zod";
import { mcpProblemsOf } from "./mcp-coverage.js";
import { isValidOperationPath, pathParamNames } from "./operation-path.js";
import {
	HTTP_METHODS,
	MCP_EXTRA_SCOPES,
	type OperationDefinition,
	type OperationInputSchema,
	type OperationSpec,
	SUCCESS_STATUSES,
	TOOLSETS,
} from "./types.js";

/** `<kebab-toolset>.<camelVerbNoun>`; capitals must start a lowercase word. */
const OPERATION_ID_PATTERN =
	/^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.([a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)*)$/;
const SCOPE_PATTERN = /^\S+$/;

function includes<T>(values: readonly T[], value: unknown): value is T {
	return values.some((candidate) => candidate === value);
}

function structuralProblems(
	spec: OperationSpec<OperationInputSchema, z.ZodType>,
): string[] {
	const problems: string[] = [];
	const idMatch = OPERATION_ID_PATTERN.exec(spec.id);
	if (!idMatch) {
		problems.push(
			"`id` must look like `toolset.verbNoun` (e.g. mock.listUsers)",
		);
	} else if (idMatch[1] !== spec.toolset) {
		problems.push(`\`id\` prefix must equal toolset "${spec.toolset}"`);
	}
	if (!includes(TOOLSETS, spec.toolset)) {
		problems.push(`unknown toolset "${String(spec.toolset)}"`);
	}
	if (!includes(HTTP_METHODS, spec.method)) {
		problems.push(`unsupported method "${String(spec.method)}"`);
	}

	if (!(spec.input instanceof z.ZodObject)) {
		problems.push("`input` must be a z.object schema");
	}
	if (!(spec.output instanceof z.ZodType)) {
		problems.push("`output` must be a zod schema");
	}
	if (!isValidOperationPath(spec.path)) {
		problems.push("`path` must use static segments and `:param` only");
	} else if (spec.input instanceof z.ZodObject) {
		const shape = spec.input.shape;
		for (const name of pathParamNames(spec.path)) {
			if (!Object.hasOwn(shape, name)) {
				problems.push(`path param ":${name}" is missing from \`input\``);
			}
		}
	}

	const scopes: unknown = spec.scopes;
	if (
		!Array.isArray(scopes) ||
		!scopes.every((s) => typeof s === "string" && SCOPE_PATTERN.test(s))
	) {
		problems.push("`scopes` must be an array of non-empty scope names");
	} else if (new Set(scopes).size !== scopes.length) {
		problems.push("`scopes` contains duplicates");
	}

	if (spec.annotations.readOnly && spec.annotations.destructive) {
		problems.push("an operation cannot be both readOnly and destructive");
	}
	// Browsers send cookies on cross-site GET navigations, so a GET must never
	// change state.
	if (spec.method === "GET" && !spec.annotations.readOnly) {
		problems.push("a GET operation must be readOnly");
	}
	if (
		spec.annotations.destructive &&
		Array.isArray(spec.scopes) &&
		spec.scopes.length === 0
	) {
		problems.push("a destructive operation cannot be public (empty `scopes`)");
	}
	if (spec.createsCredential === true) {
		if (spec.annotations.readOnly) {
			problems.push(
				"an operation that creates a credential cannot be readOnly",
			);
		}
		if (Array.isArray(spec.scopes) && spec.scopes.length === 0) {
			problems.push(
				"an operation that creates a credential cannot be public (empty `scopes`)",
			);
		}
	}
	if (spec.mcpScope !== undefined) {
		if (!includes(MCP_EXTRA_SCOPES, spec.mcpScope)) {
			problems.push(
				`\`mcpScope\` must be one of ${MCP_EXTRA_SCOPES.join(", ")}`,
			);
		} else if (spec.mcp !== true) {
			problems.push("`mcpScope` needs an MCP tool (`mcp: true`)");
		}
	}
	if (
		spec.successStatus !== undefined &&
		!includes(SUCCESS_STATUSES, spec.successStatus)
	) {
		problems.push(
			`\`successStatus\` must be one of ${SUCCESS_STATUSES.join(", ")}`,
		);
	}
	if (spec.bodyLimit !== undefined) {
		if (!Number.isSafeInteger(spec.bodyLimit) || spec.bodyLimit <= 0) {
			problems.push("`bodyLimit` must be a positive integer of bytes");
		} else if (spec.method === "GET") {
			problems.push("`bodyLimit` needs a method that has a body");
		}
	}
	if (typeof spec.handler !== "function") {
		problems.push("`handler` must be a function");
	}
	if (spec.guard !== undefined && typeof spec.guard !== "function") {
		problems.push("`guard` must be a function");
	}
	if (spec.policy !== undefined && typeof spec.policy !== "function") {
		problems.push("`policy` must be a function");
	}
	return problems;
}

/**
 * Declares an operation once; REST routes, MCP tools and OpenAPI are all
 * generated from the returned definition. Throws on an invalid declaration
 * so a bad registry fails at startup instead of at request time.
 */
export function defineOperation<
	I extends OperationInputSchema,
	O extends z.ZodType,
>(spec: OperationSpec<I, O>): OperationDefinition<I, O> {
	const problems = [
		...structuralProblems(spec),
		...mcpProblemsOf(spec).map((problem) => problem.message),
	];
	if (problems.length > 0) {
		throw new Error(
			`Invalid operation "${spec.id}":\n${problems.map((p) => `  - ${p}`).join("\n")}`,
		);
	}
	return Object.freeze({
		...spec,
		dryRun: spec.dryRun ?? false,
		createsCredential: spec.createsCredential ?? false,
		requiresConfirmation: spec.requiresConfirmation ?? false,
		successStatus: spec.successStatus ?? 200,
	});
}
