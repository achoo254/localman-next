import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { RequestEditor } from "../request/request-editor";
import { RoutingSettings } from "../routing/routing-settings";
import { TabBar } from "../tabs/tab-bar";
import { tabDomId } from "../tabs/tab-item";
import { TuneloSidebar } from "../tunelo/tunelo-sidebar";
import { EmptyEditor } from "./empty-editor";
import { SidebarRail, type SidebarSection } from "./sidebar-rail";
import { StatusBar } from "./status-bar";
import { useWorkbench } from "./workbench-context";
import type { WorkbenchTab } from "./workbench-types";

export interface WorkbenchLayoutProps {
	/** History section of the left sidebar (Tunelo and Routing are built in). */
	sidebar: ReactNode;
	/** Response area of the active tab. */
	renderResponse: (tab: WorkbenchTab) => ReactNode;
	/** Buttons in the request head (code snippet…). */
	renderHeadActions?: (tab: WorkbenchTab) => ReactNode;
	/** More ways to start from the empty editor (import, from mock). */
	emptyActions?: ReactNode;
}

function isMod(event: KeyboardEvent): boolean {
	return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}

/**
 * Columns of the API client: rail and sidebar, request, response; stacked
 * on narrow screens. Ctrl/Cmd+Enter sends the active tab and Ctrl/Cmd+S
 * saves drafts now, from anywhere inside (editors included).
 */
export function WorkbenchLayout(props: WorkbenchLayoutProps) {
	const t = useT();
	const workbench = useWorkbench();
	const { activeTab } = workbench;
	// Open beside the editor on wide screens; on narrow ones it would push it down.
	const [sidebarOpen, setSidebarOpen] = useState(
		() =>
			typeof window.matchMedia !== "function" ||
			window.matchMedia("(min-width: 64rem)").matches,
	);
	const [section, setSection] = useState<SidebarSection>("history");
	const selectSection = (next: SidebarSection) => {
		setSidebarOpen((open) => !(open && next === section));
		setSection(next);
	};
	const sidebarId = useId();
	const panelId = useId();

	const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!isMod(event)) return;
		if (event.key === "Enter" && activeTab) {
			event.preventDefault();
			event.stopPropagation();
			workbench.send(activeTab.id);
		} else if (event.key.toLowerCase() === "s") {
			event.preventDefault();
			event.stopPropagation();
			workbench.saveDrafts();
		}
	};

	return (
		<div
			data-id="workbench"
			className="flex h-full min-h-0 flex-col bg-surface"
			onKeyDownCapture={onKeyDownCapture}
		>
			<h1 className="sr-only">{t("apiClient.title")}</h1>
			<div className="flex min-h-0 flex-1 max-lg:flex-col">
				<SidebarRail
					section={section}
					open={sidebarOpen}
					sidebarId={sidebarId}
					onSelect={selectSection}
				/>
				<aside
					id={sidebarId}
					hidden={!sidebarOpen}
					aria-label={t("apiClient.sidebar.label")}
					data-id="sidebar"
					data-section={section}
					className={cn(
						"min-h-0 flex-none overflow-y-auto border-border-subtle bg-surface-subtle max-lg:max-h-64 max-lg:border-b lg:border-r",
						section === "history" ? "lg:w-64" : "lg:w-80",
					)}
				>
					{section === "history" ? props.sidebar : null}
					{section === "tunelo" ? <TuneloSidebar /> : null}
					{section === "routing" ? <RoutingSettings /> : null}
				</aside>
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<TabBar panelId={panelId} />
					<div
						id={panelId}
						data-id="editor"
						{...(activeTab
							? { role: "tabpanel", "aria-labelledby": tabDomId(activeTab.id) }
							: {})}
						className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden"
					>
						{activeTab ? (
							<>
								<div className="min-h-0 min-w-0 lg:overflow-y-auto">
									<RequestEditor
										key={activeTab.id}
										tab={activeTab}
										headActions={props.renderHeadActions?.(activeTab)}
									/>
								</div>
								<section
									aria-label={t("apiClient.response.label")}
									data-id="response"
									className="min-h-64 min-w-0 border-border-subtle max-lg:border-t lg:overflow-y-auto lg:border-l"
								>
									{props.renderResponse(activeTab)}
								</section>
							</>
						) : (
							<div className="lg:col-span-2">
								<EmptyEditor
									canOpen={workbench.canOpenTab}
									onNew={() => workbench.openTab()}
									actions={props.emptyActions}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
			<StatusBar />
		</div>
	);
}
