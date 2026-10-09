/**
 * Technical names of the MCP tab, the same in every language. Sentences
 * live in the `mcp` messages (`src/i18n/messages/<locale>/mcp.ts`).
 */
import type { MockToolAction } from "@localman/shared/constants";
import type { McpConfigFormat } from "./mcp-snippets";

/** Name of each configuration format; null: translated (`mcp.config.jsonLabel`). */
export const MCP_CONFIG_LABELS: Readonly<
	Record<McpConfigFormat, { label: string | null; caption: string }>
> = {
	claude: { label: "Claude Code", caption: "Terminal" },
	cursor: { label: "Cursor", caption: ".cursor/mcp.json" },
	json: { label: null, caption: "mcp.json" },
};

/**
 * Arguments of each tool; a child resource adds `parentId` first. `create`
 * takes a body described in words (`mcp.tools.createParams`).
 */
export const MCP_TOOL_PARAMS: Readonly<
	Record<Exclude<MockToolAction, "create">, string>
> = {
	list: "search, filter, page, limit, sortBy, order",
	get: "id",
	update: "id, body",
	delete: "id",
};

export const MCP_PARENT_PARAM = "parentId, ";
