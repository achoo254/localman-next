import type { MockToolNode } from "@localman/shared/constants";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../../components/ui/tabs";
import { MCP_COPY } from "../../features/mcp/mcp-copy";
import { McpTab } from "../../features/mcp/mcp-tab";
import type { Project } from "../projects/projects-api";

/** Query parameter holding the open tab, so docs can link to it. */
export const ENDPOINT_TAB_PARAM = "endpoint";

type EndpointTab = "rest" | "mcp";

function isEndpointTab(value: string): value is EndpointTab {
	return value === "rest" || value === "mcp";
}

/** The selected tab in `?endpoint=`, replaced (not pushed) on change. */
function useEndpointTab(): [EndpointTab, (tab: string) => void] {
	const [params, setParams] = useSearchParams();
	const current = params.get(ENDPOINT_TAB_PARAM);
	const tab: EndpointTab = current === "mcp" ? "mcp" : "rest";
	const select = (next: string) => {
		if (!isEndpointTab(next)) return;
		setParams(
			(previous) => {
				const updated = new URLSearchParams(previous);
				if (next === "rest") updated.delete(ENDPOINT_TAB_PARAM);
				else updated.set(ENDPOINT_TAB_PARAM, next);
				return updated;
			},
			{ replace: true },
		);
	};
	return [tab, select];
}

export interface EndpointTabsProps {
	project: Project;
	resources: readonly MockToolNode[];
	/** The REST panel, unchanged from the card without tabs. */
	rest: ReactNode;
}

/**
 * REST | MCP tabs of the endpoint card. The MCP panel stays mounted while
 * hidden, so a token shown once survives a look at the REST tab.
 */
export function EndpointTabs({ project, resources, rest }: EndpointTabsProps) {
	const [tab, setTab] = useEndpointTab();
	return (
		<Tabs value={tab} onValueChange={setTab}>
			<TabsList aria-label={MCP_COPY.tabListLabel}>
				<TabsTrigger value="rest" data-id="project-detail-endpoint-tab-rest">
					{MCP_COPY.tabRest}
				</TabsTrigger>
				<TabsTrigger value="mcp" data-id="project-detail-endpoint-tab-mcp">
					{MCP_COPY.tabMcp}
				</TabsTrigger>
			</TabsList>
			<TabsContent value="rest">{rest}</TabsContent>
			<TabsContent value="mcp" forceMount data-id="project-detail-mcp">
				<McpTab project={project} resources={resources} />
			</TabsContent>
		</Tabs>
	);
}
