/**
 * What environments add to the workbench while their flag is on: the
 * Environments section of the sidebar, the active-environment selector at
 * the end of the tab bar, and environment and globals pages. Off, every
 * part is absent and the workbench behaves as before.
 */
import type { ReactNode } from "react";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../api-client/workbench/workbench-context";
import type { PageTab } from "../api-client/workbench/workbench-tab-types";
import { useCurrentWorkspace } from "../workspaces/current-workspace";
import { EnvironmentPage } from "./environment-page";
import { EnvironmentSelector } from "./environment-selector";
import { EnvironmentsSidebar } from "./environments-sidebar";
import { GlobalsPage } from "./globals-page";
import { useEnvironmentsEnabled } from "./use-environments-enabled";

export interface EnvironmentsWorkbench {
	sidebar?: ReactNode;
	tabBarEnd?: ReactNode;
	/** An environment or globals page; others go to `fallback`. */
	renderPage: (
		page: PageTab,
		fallback?: (page: PageTab) => ReactNode,
	) => ReactNode;
}

export function useEnvironmentsWorkbench(): EnvironmentsWorkbench {
	const enabled = useEnvironmentsEnabled();
	const { current } = useCurrentWorkspace(enabled);
	const { activeTabId } = useWorkbenchState();
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
		tabBarEnd: <EnvironmentSelector workspaceId={current.id} />,
		renderPage,
	};
}
