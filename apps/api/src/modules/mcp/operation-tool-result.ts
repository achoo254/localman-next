import { type ErrorBody, OperationError } from "@localman/operations";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Logger } from "../../logger.js";
import type { IssuedConfirmToken } from "./confirm-token.js";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The value exactly as REST would send it (`res.json`): `toJSON` applied,
 * `undefined` members dropped.
 */
function asJson(output: unknown): Record<string, unknown> {
	const json: unknown = JSON.parse(JSON.stringify(output ?? null));
	// Every operation output is a JSON object (the registry's schemas are
	// z.object); anything else is wrapped rather than sent malformed.
	return isRecord(json) ? json : { result: json };
}

/** Successful call: structured output plus the same JSON as text. */
export function toolSuccess(output: unknown): CallToolResult {
	const structured = asJson(output);
	return {
		content: [{ type: "text", text: JSON.stringify(structured) }],
		structuredContent: structured,
	};
}

/**
 * Dry run of a destructive tool: the preview plus the confirm token, both
 * in the structured output (some clients show agents nothing else), in the
 * text and in `_meta`.
 */
export function dryRunSuccess(
	output: unknown,
	confirm: IssuedConfirmToken,
): CallToolResult {
	const structured = asJson(output);
	const expiresAt = confirm.expiresAt.toISOString();
	const text = JSON.stringify({
		dry_run: true,
		preview: structured,
		confirm_token: confirm.token,
		confirm_token_expires_at: expiresAt,
		next_step:
			"Show this preview to the user. If they approve, call the same tool again with the same input and confirm_token (without dry_run). The token works once, for 5 minutes.",
	});
	return {
		content: [{ type: "text", text }],
		structuredContent: {
			...structured,
			confirm_token: confirm.token,
			confirm_token_expires_at: expiresAt,
		},
		_meta: {
			"localman/confirm_token": confirm.token,
			"localman/confirm_token_expires_at": expiresAt,
		},
	};
}

/**
 * Failed call as an MCP tool error carrying the same `{ error: { code,
 * message, details } }` body REST sends. Unexpected errors are logged and
 * reported as `INTERNAL_ERROR` without internals, like REST's 500.
 */
export function toolFailure(
	error: unknown,
	toolName: string,
	logger: Logger,
): CallToolResult {
	let body: ErrorBody;
	if (error instanceof OperationError) {
		body = error.toBody();
	} else {
		logger.error({ err: error, tool: toolName }, "MCP tool call failed");
		body = {
			error: { code: "INTERNAL_ERROR", message: "Internal server error" },
		};
	}
	return {
		content: [{ type: "text", text: JSON.stringify(body) }],
		isError: true,
	};
}
