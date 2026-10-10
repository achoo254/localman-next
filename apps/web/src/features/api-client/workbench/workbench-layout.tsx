import { IconMenu2 } from "@tabler/icons-react";
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useState,
} from "react";
import { IconButton } from "../../../components/ui/icon-button";
import { useT } from "../../../i18n/i18n-context";
import { useDelayedFlag } from "../../../lib/use-delayed-flag";
import { RequestEditor } from "../request/request-editor";
import { TabBar } from "../tabs/tab-bar";
import { tabDomId } from "../tabs/tab-item";
import { EmptyEditor } from "./empty-editor";
import { StatusBar } from "./status-bar";
import { useWorkbench } from "./workbench-context";
import { WorkbenchSidebar } from "./workbench-sidebar";
import { WorkbenchSkeleton } from "./workbench-skeleton";
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
 * API client as in the prototype: rail and sidebar (a drawer below 768px),
 * then the tab bar over the request with its response underneath.
 * Ctrl/Cmd+Enter sends the active tab and Ctrl/Cmd+S saves drafts now,
 * from anywhere inside (editors included).
 */
export function WorkbenchLayout(props: WorkbenchLayoutProps) {
	const t = useT();
	const workbench = useWorkbench();
	const { activeTab } = workbench;
	// Saved drafts still on their way: no empty editor that would flash first.
	const restoring =
		workbench.syncStatus.state === "loading" && workbench.tabs.length === 0;
	const skeleton = useDelayedFlag(restoring);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const drawerId = useId();
	// Opening a request (from history, a new tab) brings the editor back.
	const activeTabId = activeTab?.id;
	useEffect(() => {
		if (activeTabId) setDrawerOpen(false);
	}, [activeTabId]);
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
			<div className="flex min-h-0 flex-1">
				<WorkbenchSidebar
					history={props.sidebar}
					drawerId={drawerId}
					drawerOpen={drawerOpen}
					onDrawerClose={() => setDrawerOpen(false)}
				/>
				{skeleton ? <WorkbenchSkeleton /> : null}
				{restoring && !skeleton ? (
					<div aria-busy="true" className="min-h-0 min-w-0 flex-1" />
				) : null}
				<div
					hidden={restoring || skeleton}
					className="flex min-h-0 min-w-0 flex-1 flex-col"
				>
					<TabBar
						panelId={panelId}
						leading={
							<IconButton
								size="sm"
								className="m-1 flex-none md:hidden"
								icon={<IconMenu2 size={18} aria-hidden="true" />}
								label={t("apiClient.sidebar.open")}
								aria-expanded={drawerOpen}
								aria-controls={drawerId}
								data-id="tabbar-sidebar-toggle"
								onClick={() => setDrawerOpen(true)}
							/>
						}
					/>
					<div
						id={panelId}
						data-id="editor"
						{...(activeTab
							? { role: "tabpanel", "aria-labelledby": tabDomId(activeTab.id) }
							: {})}
						className="flex min-h-0 flex-1 flex-col overflow-y-auto"
					>
						{activeTab ? (
							<>
								<div className="min-w-0 flex-none">
									<RequestEditor
										key={activeTab.id}
										tab={activeTab}
										headActions={props.renderHeadActions?.(activeTab)}
									/>
								</div>
								<section
									aria-label={t("apiClient.response.label")}
									data-id="response"
									className="flex min-h-64 min-w-0 flex-1 flex-col border-border-subtle border-t"
								>
									{props.renderResponse(activeTab)}
								</section>
							</>
						) : (
							<EmptyEditor
								canOpen={workbench.canOpenTab}
								onNew={() => workbench.openTab()}
								actions={props.emptyActions}
							/>
						)}
					</div>
				</div>
			</div>
			<StatusBar />
		</div>
	);
}
