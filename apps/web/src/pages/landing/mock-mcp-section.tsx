import {
	MOCK_TOOL_ACTIONS,
	MOCK_TOOL_ENDPOINTS,
	type MockToolNode,
	mockToolEntries,
} from "@localman/shared/constants";
import { Badge } from "../../components/ui/badge";
import { cardClassName } from "../../components/ui/card";
import { CodeBlock } from "../../components/ui/code-block";
import { DEMO_MOCK_BASE_URL } from "../../content/landing-samples";
import {
	claudeAddCommand,
	mcpEndpointUrl,
	mcpServerName,
} from "../../features/mcp/mcp-snippets";
import { McpToolList } from "../../features/mcp/mcp-tool-list";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import { LandingSection } from "./landing-section";

/** A `users` resource with every endpoint on: all five tools. */
const SAMPLE_USERS: MockToolNode = {
	id: "users",
	parentId: null,
	name: "users",
	endpoints: Object.values(MOCK_TOOL_ENDPOINTS).map((endpoint) => ({
		...endpoint,
		enabled: true,
	})),
};

const SAMPLE_COMMAND = claudeAddCommand({
	// The name of an unnamed project: the sample has no project name.
	serverName: mcpServerName(""),
	url: mcpEndpointUrl(DEMO_MOCK_BASE_URL),
	tokenEnv: null,
});

const HELP = "m-0 text-[0.8125rem] text-muted";

/**
 * "Instant Mock MCP": the Claude Code command and the tools generated for
 * a resource, with the same snippet builder and tool list as the MCP tab.
 * Loaded only when the `mockMcp` flag is on.
 */
export function MockMcpSection() {
	const t = useT();
	return (
		<LandingSection
			id="mock-mcp"
			data-id="landing-mock-mcp"
			eyebrow={t("landing.mockMcp.eyebrow")}
			title={t("landing.mockMcp.title")}
			lead={renderRich(t("landing.mockMcp.lead"))}
		>
			<div className="grid gap-6 lg:grid-cols-2">
				<div className="grid content-start gap-3">
					<CodeBlock
						wrap
						caption="Claude Code"
						code={SAMPLE_COMMAND}
						data-id="landing-mock-mcp-snippet"
					/>
					<p className={HELP}>{renderRich(t("landing.mockMcp.snippetHelp"))}</p>
				</div>
				<section
					data-id="landing-mock-mcp-tools"
					aria-labelledby="mock-mcp-tools-title"
					className={cn(cardClassName, "grid content-start gap-3 p-6")}
				>
					<div className="flex flex-wrap items-center gap-2">
						<h3
							id="mock-mcp-tools-title"
							className="m-0 font-bold font-mono text-sm"
						>
							{t("landing.mockMcp.toolsTitle")}
						</h3>
						<Badge tone="primary">
							{t("landing.mockMcp.toolsBadge", {
								count: MOCK_TOOL_ACTIONS.length,
							})}
						</Badge>
					</div>
					<McpToolList
						entries={mockToolEntries([SAMPLE_USERS])}
						itemDataIdPrefix="landing-mock-mcp-tool-"
					/>
					<p className={HELP}>{renderRich(t("landing.mockMcp.toolsHelp"))}</p>
				</section>
			</div>
		</LandingSection>
	);
}
