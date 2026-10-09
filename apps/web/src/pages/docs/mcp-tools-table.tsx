import { useT } from "../../i18n/i18n-context";
import { DocsTable, InlineCode, Prose, docsRich } from "./docs-content";
import { MOCK_TOOLSET_TOOLS, type ToolConfirmation } from "./mcp-tools-data";

const CONFIRM_KEYS = {
	none: "docs.mcp.tools.confirmNone",
	optional: "docs.mcp.tools.confirmOptional",
	required: "docs.mcp.tools.confirmRequired",
} as const satisfies Record<ToolConfirmation, string>;

/** How many tools need `dry_run` then `confirm_token`. */
const CONFIRMED_COUNT = MOCK_TOOLSET_TOOLS.filter(
	(tool) => tool.confirmation === "required",
).length;

/** The `mock` toolset of Localman MCP, one row per tool. */
export function McpToolsTable() {
	const t = useT();
	const rows = MOCK_TOOLSET_TOOLS.map((tool) => [
		<InlineCode key="t">{tool.tool}</InlineCode>,
		<span key="s" className="flex flex-wrap gap-1">
			{tool.scopes.map((scope) => (
				<InlineCode key={scope}>{scope}</InlineCode>
			))}
		</span>,
		docsRich(t(CONFIRM_KEYS[tool.confirmation])),
		t(`docs.mcp.toolSummaries.${tool.operation}`),
	]);
	return (
		<>
			<Prose>{docsRich(t("docs.mcp.tools.intro"))}</Prose>
			<DocsTable
				caption={t("docs.mcp.tools.caption")}
				headers={[
					t("docs.mcp.tools.headerTool"),
					t("docs.mcp.tools.headerScopes"),
					t("docs.mcp.tools.headerConfirm"),
					t("docs.mcp.tools.headerSummary"),
				]}
				rows={rows}
				data-id="docs-mcp-tools"
			/>
			<Prose>
				{docsRich(t("docs.mcp.tools.confirmFlow", { count: CONFIRMED_COUNT }))}
			</Prose>
		</>
	);
}
