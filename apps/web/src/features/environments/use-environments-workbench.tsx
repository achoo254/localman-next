/**
 * What environments add to the workbench while their flag is on: the
 * Environments section of the sidebar, the active-environment selector
 * and the variables quick look at the end of the tab bar, environment and
 * globals pages, and the Info rail of an environment page. Off, every
 * part is absent and the workbench behaves as before.
 */
import { type ReactNode, useState } from "react";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../api-client/workbench/workbench-context";
import type { PageTab } from "../api-client/workbench/workbench-tab-types";
import { TemporaryVariablesList } from "../variables/temporary-variables-list";
import { useCurrentWorkspace } from "../workspaces/current-workspace";
import { CreateEnvironmentButton } from "./create-environment-button";
import { EnvironmentPage } from "./environment-page";
import { EnvironmentRightRail } from "./environment-right-rail";
import { EnvironmentSelector } from "./environment-selector";
import { EnvironmentsSidebar } from "./environments-sidebar";
import { GlobalsPage } from "./globals-page";
import { useEnvironmentsEnabled } from "./use-environments-enabled";
import { VariablesPane } from "./variables-pane";

export interface EnvironmentsWorkbench {
	sidebar?: ReactNode;
	tabBarEnd?: ReactNode;
	/** Info of the environment page in view, if any. */
	rightRail?: ReactNode;
	/** An environment or globals page; others go to `fallback`. */
	renderPage: (
		page: PageTab,
		fallback?: (page: PageTab) => ReactNode,
	) => ReactNode;
}

export function useEnvironmentsWorkbench(): EnvironmentsWorkbench {
	const enabled = useEnvironmentsEnabled();
	const { current } = useCurrentWorkspace(enabled);
	const { activeTabId, activePage } = useWorkbenchState();
	const [infoOpen, setInfoOpen] = useState(false);
	const { closeTab } = useWorkbenchActions();
	const renderPage: EnvironmentsWorkbench["renderPage"] = (page, fallback) => {
		if (page.kind === "environment") {
			return <EnvironmentPage key={page.id} page={page} />;
		}
		if (page.kind === "globals")
			return <GlobalsPage key={page.id} page={page} />;
		return fallback?.(page) ?? null;
	};
	if (!enabled || !current) return { renderPage };
	return {
		sidebar: (
			<EnvironmentsSidebar
				workspace={current}
				openedId={activeTabId}
				onClosePage={closeTab}
			/>
		),
		tabBarEnd: (
			<>
				<EnvironmentSelector
					workspaceId={current.id}
					canCreate={current.role !== "viewer"}
				/>
				{current.role === "viewer" ? null : (
					<CreateEnvironmentButton workspaceId={current.id} />
				)}
				<VariablesPane
					workspaceId={current.id}
					temporary={<TemporaryVariablesList />}
				/>
			</>
		),
		rightRail:
			activePage?.kind === "environment" ? (
				<EnvironmentRightRail
					environmentId={activePage.targetId}
					open={infoOpen}
					onOpenChange={setInfoOpen}
				/>
			) : undefined,
		renderPage,
	};
}
