import {
	type AnyOperation,
	CREDENTIALS_WRITE_SCOPE,
	MCP_EXTRA_SCOPES,
	TOOLSETS,
	type Toolset,
	mcpScopesOf,
	scopeAreaOf,
} from "@localman/operations";
import type { AuthInfo } from "@modelcontextprotocol/server";

/**
 * Toolsets an OAuth token of the IdP can open: the IdP grants the MCP
 * resource `mock:*` and `client:*` scopes only (`mock-advanced` and
 * `traffic` tools use the `mock:*` scopes, `sharing` and `public` the
 * `client:*` ones, see `scopeAreaOf`), so account, notification and admin
 * tools are never reachable through Localman MCP. `collab` (project
 * collaborators) stays closed until it is decided.
 */
export const OAUTH_TOOLSETS: readonly Toolset[] = [
	"mock",
	"mock-advanced",
	"traffic",
	"client",
	"sharing",
	"public",
];

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
 * `mock:write` → `mock` and `mock-advanced`); a scope of a toolset
 * without tools opens nothing. Each tool still checks its own scope.
 */
const STEP_UP_ONLY: ReadonlySet<string> = new Set([
	CREDENTIALS_WRITE_SCOPE,
	"client:share",
]);
const EXTRA_SCOPES: ReadonlySet<string> = new Set(MCP_EXTRA_SCOPES);
const isExtraScope = (scope: string): boolean => EXTRA_SCOPES.has(scope);

export function toolsetsOpenedBy(
	scopes: readonly string[],
	operations: readonly AnyOperation[],
): Set<Toolset> {
	return new Set(
		operations
			.map((op) => op.toolset)
			.filter((toolset) =>
				// An extra scope (client:send) only adds to a toolset's own scopes.
				scopes.some(
					(scope) =>
						!isExtraScope(scope) &&
						scope.startsWith(`${scopeAreaOf(toolset)}:`),
				),
			),
	);
}

/**
 * Scopes of the reachable tools, advertised in the metadata and in
 * challenges: `<toolset>:read|write` and extras such as `client:send`
 * (`send_request`), which the IdP grants every MCP client by default.
 * `credentials:write` is left out on purpose:
 * clients request what is advertised, and the IdP grants that scope only
 * to clients registered for it, so it comes by step-up when a credential
 * tool is called (403 `insufficient_scope`). `client:share` (giving
 * someone access) likewise: the user must grant it to an agent themselves.
 */
export function baseScopesOf(operations: readonly AnyOperation[]): string[] {
	const scopes = operations.flatMap((op) => mcpScopesOf(op));
	return [...new Set(scopes)].filter((s) => !STEP_UP_ONLY.has(s));
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
