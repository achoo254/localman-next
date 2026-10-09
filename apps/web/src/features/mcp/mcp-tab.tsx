import type { MockToolNode } from "@localman/shared/constants";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../components/ui/badge";
import { CopyField } from "../../components/ui/copy-field";
import { useT } from "../../i18n/i18n-context";
import type { Project } from "../../pages/projects/projects-api";
import { McpConfigSnippets, type McpTokenMode } from "./mcp-config-snippets";
import {
	type McpTarget,
	mcpEndpointUrl,
	mcpServerName,
	mcpTokenEnvVar,
} from "./mcp-snippets";
import { fetchMcpTokenStatus, mcpTokenQueryKey } from "./mcp-token-api";
import { McpTokenSettings } from "./mcp-token-settings";
import { McpToolsSection } from "./mcp-tools-section";

export interface McpTabProps {
	project: Project;
	resources: readonly MockToolNode[];
}

/**
 * Panel "MCP" of the endpoint card: URL, agent configuration, token
 * setting (owner only) and generated tools. The URL follows the project's
 * mock base URL, so rotating the secret changes it too.
 */
export function McpTab({ project, resources }: McpTabProps) {
	const t = useT();
	const owner = project.role === "owner";
	const query = useQuery({
		queryKey: mcpTokenQueryKey(project.id),
		queryFn: () => fetchMcpTokenStatus(project.id),
		enabled: owner,
	});
	const tokenEnv = mcpTokenEnvVar(project.name);
	const mode: McpTokenMode =
		owner && query.data ? (query.data.required ? "on" : "off") : "unknown";
	const target: McpTarget = {
		serverName: mcpServerName(project.name),
		url: mcpEndpointUrl(project.mockBaseUrl),
		tokenEnv: mode === "on" ? tokenEnv : null,
	};

	return (
		<div className="grid gap-6 p-6">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="m-0 font-mono font-semibold text-[0.8125rem] text-muted">
					{t("mcp.endpoint.title")}
				</h2>
				<Badge>Streamable HTTP</Badge>
			</div>
			<CopyField
				label={t("mcp.endpoint.urlLabel")}
				hideLabel
				itemLabel={t("mcp.endpoint.urlItem")}
				value={target.url}
				hint={t("mcp.endpoint.urlHint")}
				data-id="project-detail-mcp-url"
				copyDataId="project-detail-mcp-url-copy"
			/>
			<McpConfigSnippets target={target} tokenMode={mode} />
			<McpTokenSettings project={project} query={query} tokenEnv={tokenEnv} />
			<McpToolsSection resources={resources} target={target} />
		</div>
	);
}
