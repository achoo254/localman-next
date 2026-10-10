import type { MockToolNode } from "@localman/shared/constants";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../../components/ui/tabs";
import { useFeatures } from "../../config/features";
import { McpTab } from "../../features/mcp/mcp-tab";
import { RequestLogPanel } from "../../features/request-log/request-log-panel";
import { UpstreamSettings } from "../../features/upstream/upstream-settings";
import { useT } from "../../i18n/i18n-context";
import type { Project } from "../projects/projects-api";
import { useTabRowScroll } from "./use-tab-row-scroll";

/** Query parameter holding the open tab, so docs can link to it. */
export const ENDPOINT_TAB_PARAM = "endpoint";

const ENDPOINT_TABS = ["rest", "mcp", "upstream", "log", "inbox"] as const;
type EndpointTab = (typeof ENDPOINT_TABS)[number];

const tabDataId = (tab: EndpointTab) => `project-detail-endpoint-tab-${tab}`;

function isEndpointTab(value: string): value is EndpointTab {
	return ENDPOINT_TABS.some((tab) => tab === value);
}

/**
 * The selected tab in `?endpoint=`, replaced (not pushed) on change. A tab
 * that is not shown (flag off, no inbox) falls back to REST.
 */
function useEndpointTab(
	shown: readonly EndpointTab[],
): [EndpointTab, (tab: string) => void] {
	const [params, setParams] = useSearchParams();
	const current = params.get(ENDPOINT_TAB_PARAM) ?? "";
	const tab: EndpointTab =
		isEndpointTab(current) && shown.includes(current) ? current : "rest";
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
	/** Null while they load: the MCP tools show a skeleton. */
	resources: readonly MockToolNode[] | null;
	/** The REST panel, unchanged from the card without tabs. */
	rest: ReactNode;
	/** Content of the Inbox tab (webhook inboxes); no tab without it. */
	inbox?: ReactNode;
}

/**
 * Tabs of the endpoint card: REST, MCP (`mockMcp`), then Upstream, Request
 * log and Inbox (`hybridMock`). The MCP panel stays mounted while hidden
 * (`forceMount` drops Radix's `hidden`, so the class hides it), so a token
 * shown once survives a look at the REST tab; the traffic panels mount
 * only while open, so the live log closes with its tab. On a narrow screen
 * the row fades at the right while tabs hide there.
 */
export function EndpointTabs({
	project,
	resources,
	rest,
	inbox,
}: EndpointTabsProps) {
	const t = useT();
	const flags = useFeatures();
	const traffic = flags.hybridMock;
	const shown: EndpointTab[] = ["rest"];
	if (flags.mockMcp) shown.push("mcp");
	if (traffic) shown.push("upstream", "log");
	if (traffic && inbox !== undefined) shown.push("inbox");
	const [tab, setTab] = useEndpointTab(shown);
	const row = useTabRowScroll(`[data-id="${tabDataId(tab)}"]`);
	const labels: Record<EndpointTab, string> = {
		rest: t("mcp.tabs.rest"),
		mcp: t("mcp.tabs.mcp"),
		upstream: t("upstream.tab"),
		log: t("trafficLog.tab"),
		inbox: t("trafficLog.inboxTab"),
	};
	return (
		<Tabs value={tab} onValueChange={setTab}>
			<div className="relative">
				<TabsList
					ref={row.rowRef}
					aria-label={t("mcp.tabs.label")}
					className="relative"
				>
					{shown.map((id) => (
						<TabsTrigger
							key={id}
							value={id}
							className="flex-none"
							data-id={tabDataId(id)}
						>
							{labels[id]}
						</TabsTrigger>
					))}
				</TabsList>
				{row.fade ? (
					<div
						aria-hidden="true"
						data-id="project-detail-endpoint-tabs-fade"
						className="pointer-events-none absolute top-0 right-0 bottom-px w-12 bg-linear-to-l from-surface to-transparent"
					/>
				) : null}
			</div>
			<TabsContent value="rest">{rest}</TabsContent>
			{flags.mockMcp ? (
				<TabsContent
					value="mcp"
					forceMount
					data-id="project-detail-mcp"
					className="data-[state=inactive]:hidden"
				>
					<McpTab project={project} resources={resources} />
				</TabsContent>
			) : null}
			{traffic ? (
				<>
					<TabsContent value="upstream" data-id="project-detail-upstream">
						<UpstreamSettings project={project} />
					</TabsContent>
					<TabsContent value="log" data-id="project-detail-request-log">
						<RequestLogPanel project={project} />
					</TabsContent>
				</>
			) : null}
			{traffic && inbox !== undefined ? (
				<TabsContent value="inbox" data-id="project-detail-inbox">
					{inbox}
				</TabsContent>
			) : null}
		</Tabs>
	);
}
