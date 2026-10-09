/**
 * Configuration snippets for the Hosted Mock MCP endpoint: Claude Code,
 * Cursor, generic `.mcp.json` and the MCP Inspector commands. A token is
 * never written into a snippet; when the project requires one, the
 * snippet reads it from a per-project environment variable, because
 * `.cursor/mcp.json` and `.mcp.json` are usually committed.
 */
import { MOCK_MCP_SEGMENT } from "@localman/shared/constants";

/** Major 2: `--transport http` and `--server-url` are v2 syntax. */
export const INSPECTOR_PACKAGE = "@modelcontextprotocol/inspector@2";
export const INSPECTOR_DOCS_URL =
	"https://github.com/modelcontextprotocol/inspector";

export const MCP_CONFIG_FORMATS = ["claude", "cursor", "json"] as const;
export type McpConfigFormat = (typeof MCP_CONFIG_FORMATS)[number];

const SLUG_MAX = 40;
const FALLBACK_SLUG = "mock";

/** Where an agent connects, and the variable holding the token if any. */
export interface McpTarget {
	serverName: string;
	url: string;
	/** Environment variable with the Bearer token; null when not required. */
	tokenEnv: string | null;
}

/**
 * ASCII slug of a project name: accents dropped, `đ` → `d`, lower case,
 * runs of other characters → `-`, at most 40 characters. "" when nothing
 * is left.
 */
export function mcpProjectSlug(name: string): string {
	return name
		.normalize("NFD")
		.replace(/\p{M}+/gu, "")
		.replace(/[đĐ]/g, "d")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, SLUG_MAX)
		.replace(/-+$/, "");
}

/** `localman-cua-hang`: one name per project, so two never collide. */
export function mcpServerName(projectName: string): string {
	return `localman-${mcpProjectSlug(projectName) || FALLBACK_SLUG}`;
}

/** `LOCALMAN_MCP_TOKEN_CUA_HANG`: one variable per project. */
export function mcpTokenEnvVar(projectName: string): string {
	const slug = mcpProjectSlug(projectName) || FALLBACK_SLUG;
	return `LOCALMAN_MCP_TOKEN_${slug.toUpperCase().replace(/-/g, "_")}`;
}

/** `{mockBaseUrl}/mcp`; the base URL already carries secret and prefix. */
export function mcpEndpointUrl(mockBaseUrl: string): string {
	return `${mockBaseUrl.replace(/\/+$/, "")}/${MOCK_MCP_SEGMENT}`;
}

/**
 * Shell header flag. `$VAR` is bash/zsh syntax, expanded by the shell at
 * run time; PowerShell reads `$env:VAR` and cmd `%VAR%`, so the UI says
 * so next to every command that carries it (`MCP_COPY.shellHint`).
 */
function shellHeader(tokenEnv: string | null): string {
	return tokenEnv ? ` --header "Authorization: Bearer $${tokenEnv}"` : "";
}

/**
 * One line, so it pastes in any shell; without a token it runs as is
 * everywhere, with one it reads the variable the bash/zsh way.
 */
export function claudeAddCommand(target: McpTarget): string {
	return `claude mcp add --transport http ${target.serverName} ${target.url}${shellHeader(target.tokenEnv)}`;
}

function jsonConfig(
	target: McpTarget,
	entry: Record<string, unknown>,
	envReference: (name: string) => string,
): string {
	const headers = target.tokenEnv
		? { headers: { Authorization: `Bearer ${envReference(target.tokenEnv)}` } }
		: {};
	return JSON.stringify(
		{ mcpServers: { [target.serverName]: { ...entry, ...headers } } },
		null,
		2,
	);
}

/** `.cursor/mcp.json`: Cursor reads variables as `${env:NAME}`. */
export function cursorConfig(target: McpTarget): string {
	return jsonConfig(target, { url: target.url }, (name) => `\${env:${name}}`);
}

/**
 * `.mcp.json`: `type: "http"` is required (an entry without it is a stdio
 * server for Claude Code); variables read as `${NAME}`.
 */
export function genericMcpConfig(target: McpTarget): string {
	return jsonConfig(
		target,
		{ type: "http", url: target.url },
		(name) => `\${${name}}`,
	);
}

export function mcpConfigSnippet(
	format: McpConfigFormat,
	target: McpTarget,
): string {
	if (format === "claude") return claudeAddCommand(target);
	if (format === "cursor") return cursorConfig(target);
	return genericMcpConfig(target);
}

/**
 * Opens the Inspector web UI on the user's machine. `--header` takes
 * several values, so it stays last.
 */
export function inspectorCommand(target: McpTarget): string {
	return `npx -y ${INSPECTOR_PACKAGE} --transport http --server-url ${target.url}${shellHeader(target.tokenEnv)}`;
}

/** Lists the tools in the terminal; mode flags must come first. */
export function inspectorCliCommand(target: McpTarget): string {
	return `npx -y ${INSPECTOR_PACKAGE} --cli --transport http --server-url ${target.url} --method tools/list${shellHeader(target.tokenEnv)}`;
}
