import {
	type AnyOperation,
	CREDENTIALS_WRITE_SCOPE,
	TOOLSETS,
	type Toolset,
	mcpScopesOf,
} from "@localman/operations";
import type { AuthInfo } from "@modelcontextprotocol/server";

/**
 * Toolsets an OAuth token of the IdP can open: the IdP grants the MCP
 * resource `mock:*` and `client:*` scopes only, so account, notification
 * and admin tools are never reachable through Localman MCP.
 */
export const OAUTH_TOOLSETS: readonly Toolset[] = ["mock", "client"];

/** Operations with an MCP tool in a toolset OAuth tokens can open. */
export function oauthReachableOperations(
	operations: readonly AnyOperation[],
): AnyOperation[] {
	return operations.filter(
		(op) => op.mcp === true && OAUTH_TOOLSETS.includes(op.toolset),
	);
}

const CALLER_KEY = "localman/caller";

/** Caller facts the transport resolved, handed to the per-request server. */
export interface McpCallerContext {
	readonly subjectId: string;
	readonly clientIp: string | null;
	readonly toolsets: readonly Toolset[];
}

function isToolset(value: unknown): value is Toolset {
	return TOOLSETS.some((toolset) => toolset === value);
}

function isCallerContext(value: unknown): value is McpCallerContext {
	return (
		typeof value === "object" &&
		value !== null &&
		"subjectId" in value &&
		typeof value.subjectId === "string" &&
		"clientIp" in value &&
		(value.clientIp === null || typeof value.clientIp === "string") &&
		"toolsets" in value &&
		Array.isArray(value.toolsets) &&
		value.toolsets.every(isToolset)
	);
}

/**
 * Toolsets with tools that the token's scopes open (`mock:read` or
 * `mock:write` → `mock`); a scope of a toolset without tools opens nothing.
 */
export function toolsetsOpenedBy(
	scopes: readonly string[],
	operations: readonly AnyOperation[],
): Set<Toolset> {
	return new Set(
		operations
			.map((op) => op.toolset)
			.filter((toolset) =>
				scopes.some((scope) => scope.startsWith(`${toolset}:`)),
			),
	);
}

/**
 * `<toolset>:read|write` scopes of the reachable tools, advertised in the
 * metadata and in challenges. `credentials:write` is left out on purpose:
 * clients request what is advertised, and the IdP grants that scope only
 * to clients registered for it, so it comes by step-up when a credential
 * tool is called (403 `insufficient_scope`).
 */
export function baseScopesOf(operations: readonly AnyOperation[]): string[] {
	const scopes = operations.flatMap((op) => mcpScopesOf(op));
	return [...new Set(scopes)].filter((s) => s !== CREDENTIALS_WRITE_SCOPE);
}

/** `extra` of the SDK's `AuthInfo` carrying the caller to the server factory. */
export function callerExtra(caller: McpCallerContext): Record<string, unknown> {
	return { [CALLER_KEY]: caller };
}

/** The caller the HTTP layer attached; throws when it is missing. */
export function callerOf(authInfo: AuthInfo | undefined): McpCallerContext {
	const caller = authInfo?.extra?.[CALLER_KEY];
	if (!isCallerContext(caller)) {
		throw new Error("MCP request reached the server without a caller");
	}
	return caller;
}
