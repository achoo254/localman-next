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
import { CodeSpans } from "../../features/mcp/code-spans";
import {
	claudeAddCommand,
	mcpEndpointUrl,
	mcpServerName,
} from "../../features/mcp/mcp-snippets";
import { McpToolList } from "../../features/mcp/mcp-tool-list";
import { cn } from "../../lib/cn";
import { LandingSection } from "./landing-section";

const COPY = {
	eyebrow: "Mock MCP tức thì",
	title: "Mock của bạn thành tool cho AI agent",
	lead: "Mỗi project mock có sẵn một MCP endpoint. Agent gọi `list_users` hay `create_posts` trên chính dữ liệu có trạng thái của mock, bạn không phải tự viết MCP server.",
	snippetCaption: "Claude Code",
	snippetHelp:
		"Streamable HTTP · dùng chung dữ liệu với REST. Thay `a1b2c3d4` bằng secret của project; lệnh đầy đủ nằm ở tab MCP của project.",
	toolsTitle: "Tool tự sinh từ resource",
	toolsBadge: `${MOCK_TOOL_ACTIONS.length} tool mỗi resource`,
	toolsHelp:
		"Resource lồng như `posts` nhận thêm `parentId`. Tạo bản ghi qua MCP thì `GET /users` thấy ngay.",
} as const;

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
 * "Mock MCP tức thì": the Claude Code command and the tools generated for
 * a resource, with the same snippet builder and tool list as the MCP tab.
 * Loaded only when the `mockMcp` flag is on.
 */
export function MockMcpSection() {
	return (
		<LandingSection
			id="mock-mcp"
			data-id="landing-mock-mcp"
			eyebrow={COPY.eyebrow}
			title={COPY.title}
			lead={<CodeSpans text={COPY.lead} />}
		>
			<div className="grid gap-6 lg:grid-cols-2">
				<div className="grid content-start gap-3">
					<CodeBlock
						wrap
						caption={COPY.snippetCaption}
						code={SAMPLE_COMMAND}
						data-id="landing-mock-mcp-snippet"
					/>
					<p className={HELP}>
						<CodeSpans text={COPY.snippetHelp} />
					</p>
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
							{COPY.toolsTitle}
						</h3>
						<Badge tone="primary">{COPY.toolsBadge}</Badge>
					</div>
					<McpToolList
						entries={mockToolEntries([SAMPLE_USERS])}
						itemDataIdPrefix="landing-mock-mcp-tool-"
					/>
					<p className={HELP}>
						<CodeSpans text={COPY.toolsHelp} />
					</p>
				</section>
			</div>
		</LandingSection>
	);
}
