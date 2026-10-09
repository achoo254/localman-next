import {
	type AnyOperation,
	type AuthContext,
	type McpToolDescriptor,
	OperationError,
	executeOperation,
} from "@localman/operations";
import {
	type CallToolResult,
	type McpServer,
	type RegisteredTool,
	requireScopes,
} from "@modelcontextprotocol/server";
import type { Logger } from "../../logger.js";
import type { ConfirmTokenService } from "./confirm-token.js";
import {
	dryRunSuccess,
	toolFailure,
	toolSuccess,
} from "./operation-tool-result.js";
import {
	CONFIRM_TOKEN_ARG,
	DRY_RUN_ARG,
	type ToolArgs,
	advertisedSchema,
	prepareOperationTool,
} from "./operation-tool-schema.js";

/** Who calls the MCP server, as the transport authenticated them. */
export interface McpCaller {
	/** Identity handlers see; checked against the operation's `scopes` like REST. */
	readonly auth: AuthContext | null;
	/** Scopes of the MCP access token; checked against the tool's scopes. */
	readonly tokenScopes: readonly string[];
	readonly clientIp: string | null;
}

export interface OperationToolDeps {
	readonly caller: McpCaller;
	readonly confirmTokens: ConfirmTokenService;
	readonly logger: Logger;
}

function invalidArgument(message: string): OperationError {
	return new OperationError(400, "VALIDATION_ERROR", message);
}

/** Separates the MCP control arguments from the operation's input. */
function splitArguments(args: ToolArgs, tool: McpToolDescriptor) {
	const {
		[DRY_RUN_ARG]: dryRun,
		[CONFIRM_TOKEN_ARG]: confirmToken,
		...input
	} = args;
	if (dryRun !== undefined) {
		// Dropping the flag silently would perform the real change.
		if (!tool.dryRun) {
			throw invalidArgument(
				`Tool "${tool.name}" does not support "${DRY_RUN_ARG}"`,
			);
		}
		if (typeof dryRun !== "boolean") {
			throw invalidArgument(`"${DRY_RUN_ARG}" must be a boolean`);
		}
	}
	if (confirmToken !== undefined) {
		if (!tool.requiresConfirmation) {
			throw invalidArgument(
				`Tool "${tool.name}" does not take "${CONFIRM_TOKEN_ARG}"`,
			);
		}
		if (typeof confirmToken !== "string") {
			throw invalidArgument(`"${CONFIRM_TOKEN_ARG}" must be a string`);
		}
	}
	return {
		dryRun: dryRun === true,
		confirmToken: typeof confirmToken === "string" ? confirmToken : undefined,
		input,
	};
}

function assertTokenScopes(
	tool: McpToolDescriptor,
	granted: readonly string[],
): void {
	const missing = tool.scopes.filter((scope) => !granted.includes(scope));
	if (missing.length > 0) {
		throw new OperationError(
			403,
			"INSUFFICIENT_SCOPE",
			`The access token is missing scope: ${missing.join(", ")}`,
			{ scopes: missing.join(" ") },
		);
	}
}

function subjectOf(auth: AuthContext | null): string {
	if (!auth) {
		throw new OperationError(401, "UNAUTHENTICATED", "Authentication required");
	}
	return auth.subjectId;
}

async function callTool(
	op: AnyOperation,
	tool: McpToolDescriptor,
	args: ToolArgs,
	deps: OperationToolDeps,
): Promise<CallToolResult> {
	const { caller, confirmTokens } = deps;
	assertTokenScopes(tool, caller.tokenScopes);
	let confirmToken: string | undefined;
	const result = await executeOperation(op, {
		auth: caller.auth,
		clientIp: caller.clientIp,
		readRequest: () => {
			const split = splitArguments(args, tool);
			confirmToken = split.confirmToken;
			return { dryRun: split.dryRun, input: split.input };
		},
		// After policy, so only an authorized caller burns a token.
		beforeHandler: (ctx, input) => {
			if (!tool.requiresConfirmation || ctx.dryRun) return;
			const subjectId = subjectOf(ctx.auth);
			confirmTokens.consume(confirmToken, {
				subjectId,
				tool: tool.name,
				input,
			});
		},
	});
	if (tool.requiresConfirmation && result.ctx.dryRun) {
		const issued = confirmTokens.issue({
			subjectId: subjectOf(result.ctx.auth),
			tool: tool.name,
			input: result.input,
		});
		return dryRunSuccess(result.output, issued);
	}
	return toolSuccess(result.output);
}

/**
 * Registers one operation as an MCP tool that runs through the same
 * checks and handler as its REST route. Returns `null` for exempt
 * operations.
 */
export function registerOperationTool(
	server: McpServer,
	op: AnyOperation,
	deps: OperationToolDeps,
): RegisteredTool | null {
	const prepared = prepareOperationTool(op);
	if (!prepared) return null;
	const tool = prepared.descriptor;
	const [firstScope, ...otherScopes] = tool.scopes;
	return server.registerTool(
		tool.name,
		{
			title: op.summary,
			description: prepared.description,
			inputSchema: advertisedSchema(prepared.inputSchema),
			outputSchema: advertisedSchema(tool.outputSchema),
			annotations: { ...tool.annotations, openWorldHint: false },
			// Over HTTP with a verified token, a missing scope becomes an
			// OAuth `insufficient_scope` challenge (incremental consent).
			scopeChallenge: firstScope
				? requireScopes(firstScope, ...otherScopes)
				: undefined,
			_meta: {
				"localman/toolset": tool.toolset,
				"localman/scopes": tool.scopes,
				"localman/operation": tool.operationId,
			},
		},
		async (args) => {
			try {
				return await callTool(op, tool, args, deps);
			} catch (error) {
				return toolFailure(error, tool.name, deps.logger);
			}
		},
	);
}
