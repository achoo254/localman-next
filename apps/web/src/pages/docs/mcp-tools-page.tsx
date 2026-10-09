import { limitsFor } from "@localman/shared/constants";
import { Navigate } from "react-router";
import { CodeBlock } from "../../components/ui/code-block";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import {
	DocsArticle,
	DocsSection,
	DocsTable,
	InlineCode,
	Prose,
	docsRich,
} from "./docs-content";
import {
	IDP_HOST,
	LOCALMAN_MCP_URL,
	MOCK_URL_FALLBACK,
	MOCK_URL_PATTERN,
	docsPath,
} from "./docs-pages";
import { McpToolsTable } from "./mcp-tools-table";

const freeMonthly = limitsFor("free").mockRequestsPerMonth;

/** Code samples: commands and config files are never translated. */
const CLAUDE_COMMAND = `claude mcp add --transport http localman ${LOCALMAN_MCP_URL}`;
const CURSOR_CONFIG = JSON.stringify(
	{ mcpServers: { localman: { url: LOCALMAN_MCP_URL } } },
	null,
	2,
);

/**
 * `/docs/mcp`: Hosted Mock MCP of each project and Localman MCP with its
 * tools. Only while Mock MCP runs in production; otherwise the docs start.
 */
export function McpToolsPage() {
	const t = useT();
	const { mockMcp } = useFeatures();
	if (!mockMcp) {
		return <Navigate to={docsPath("quick-start")} replace />;
	}
	return (
		<DocsArticle
			title={t("docs.pages.mcp.title")}
			lead={t("docs.mcp.lead")}
			data-id="docs-mcp"
		>
			<DocsSection id="hosted" title={t("docs.mcp.hosted.title")}>
				<Prose>
					{docsRich(t("docs.mcp.hosted.url", { url: "{mockBaseUrl}/mcp" }))}
				</Prose>
				<DocsTable
					caption={t("docs.mcp.hosted.caption")}
					headers={[
						t("docs.quickStart.mockUrl.headerForm"),
						t("docs.quickStart.mockUrl.headerUrl"),
					]}
					rows={[
						[
							t("docs.quickStart.mockUrl.subdomain"),
							<InlineCode key="u">{`${MOCK_URL_PATTERN}/mcp`}</InlineCode>,
						],
						[
							t("docs.quickStart.mockUrl.path"),
							<InlineCode key="u">{`${MOCK_URL_FALLBACK}/mcp`}</InlineCode>,
						],
					]}
					data-id="docs-mcp-hosted-url"
				/>
				<Prose>
					{docsRich(
						t("docs.mcp.hosted.tools", { listShape: "{ items, total }" }),
					)}
				</Prose>
				<Prose>{docsRich(t("docs.mcp.hosted.resources"))}</Prose>
				<Prose>{docsRich(t("docs.mcp.hosted.token"))}</Prose>
				<Prose>
					{docsRich(
						freeMonthly === null
							? t("docs.mcp.hosted.limits")
							: t("docs.mcp.hosted.limitsFree", { requests: freeMonthly }),
					)}
				</Prose>
			</DocsSection>

			<DocsSection id="localman" title={t("docs.mcp.localman.title")}>
				<Prose>
					{docsRich(t("docs.mcp.localman.intro", { url: LOCALMAN_MCP_URL }))}
				</Prose>
				<Prose>
					{docsRich(t("docs.mcp.localman.signIn", { idp: IDP_HOST }))}
				</Prose>
				<CodeBlock
					caption="Claude Code"
					code={CLAUDE_COMMAND}
					wrap
					data-id="docs-mcp-claude"
				/>
				<Prose>{docsRich(t("docs.mcp.localman.claudeAfter"))}</Prose>
				<CodeBlock
					caption=".cursor/mcp.json"
					code={CURSOR_CONFIG}
					data-id="docs-mcp-cursor"
				/>
				<Prose>{t("docs.mcp.localman.cursorAfter")}</Prose>
				<Prose>{docsRich(t("docs.mcp.localman.limits"))}</Prose>
			</DocsSection>

			<DocsSection id="tools" title={t("docs.mcp.tools.title")}>
				<McpToolsTable />
			</DocsSection>
		</DocsArticle>
	);
}
