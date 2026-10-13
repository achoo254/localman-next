import { DRAFT_MAX_TABS } from "@localman/shared/api-client";
import { IconPlus } from "@tabler/icons-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { IconButton } from "../../../components/ui/icon-button";
import { useT } from "../../../i18n/i18n-context";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../workbench/workbench-context";
import type { WorkbenchTab } from "../workbench/workbench-types";
import { CloseTabModal } from "./close-tab-modal";
import { PageTabItem } from "./page-tab-item";
import { TabContextMenu } from "./tab-context-menu";
import { TabItem, tabDomId } from "./tab-item";
import { TabOverflowMenu } from "./tab-overflow-menu";
import { useTabClosing } from "./use-tab-closing";
import { useTabKeys } from "./use-tab-keys";
import { useTabMenuActions } from "./use-tab-menu-actions";

export interface TabBarProps {
	panelId: string;
	/** Control before the tabs (the sidebar drawer button on narrow screens). */
	leading?: ReactNode;
	/** Controls at the far end (the active environment). */
	trailing?: ReactNode;
}

/**
 * Open requests as tabs (←/→, Home/End, Delete to close) plus "New";
 * each tab has a right-click menu, "…" lists every tab and closes in bulk.
 */
export function TabBar({ panelId, leading, trailing }: TabBarProps) {
	const t = useT();
	const { tabs, pages, activeTabId, canOpenTab } = useWorkbenchState();
	const { activateTab, openTab, currentTabs } = useWorkbenchActions();
	const closing = useTabClosing();
	const { requestClose } = closing;
	const refocus = useRef(false);
	const ids = useMemo(
		() => [...tabs, ...pages].map((item) => item.id),
		[tabs, pages],
	);
	// Handlers read these, so they stay the same for memoized tabs.
	const latestIds = useRef<readonly string[]>(ids);
	latestIds.current = ids;
	const latestActive = useRef(activeTabId);
	latestActive.current = activeTabId;

	// After a keyboard switch or a close, focus follows the active tab.
	useEffect(() => {
		if (!refocus.current) return;
		refocus.current = false;
		if (activeTabId) document.getElementById(tabDomId(activeTabId))?.focus();
	}, [activeTabId]);

	const closeOne = useCallback(
		(tab: WorkbenchTab) => requestClose([tab.id]),
		[requestClose],
	);
	const closeById = useCallback(
		(id: string) => requestClose([id]),
		[requestClose],
	);
	const onKeyDown = useTabKeys(
		latestIds,
		useCallback(
			(id: string) => {
				refocus.current = true;
				activateTab(id);
			},
			[activateTab],
		),
		useCallback(
			(id: string) => {
				const tab = currentTabs().find((item) => item.id === id);
				refocus.current = !tab?.dirty;
				requestClose([id]);
			},
			[currentTabs, requestClose],
		),
	);

	const menuActions = useTabMenuActions(latestActive, requestClose);

	const limit = t("apiClient.tabs.limit", { max: DRAFT_MAX_TABS });
	return (
		<div
			data-id="tabbar"
			className="flex min-w-0 items-stretch border-border-subtle border-b bg-surface-subtle"
		>
			{leading}
			{ids.length > 0 ? (
				<div
					role="tablist"
					aria-label={t("apiClient.tabs.label")}
					data-id="tabbar-tabs"
					className="flex min-w-0 overflow-x-auto [scrollbar-width:thin]"
				>
					{tabs.map((tab) => (
						<TabContextMenu
							key={tab.id}
							tabId={tab.id}
							ids={ids}
							duplicable
							actions={menuActions}
						>
							<TabItem
								tab={tab}
								active={tab.id === activeTabId}
								panelId={panelId}
								onSelect={activateTab}
								onClose={closeOne}
								onKeyDown={onKeyDown}
							/>
						</TabContextMenu>
					))}
					{pages.map((page) => (
						<TabContextMenu
							key={page.id}
							tabId={page.id}
							ids={ids}
							duplicable={false}
							actions={menuActions}
						>
							<PageTabItem
								page={page}
								active={page.id === activeTabId}
								panelId={panelId}
								onSelect={activateTab}
								onClose={closeById}
								onKeyDown={onKeyDown}
							/>
						</TabContextMenu>
					))}
				</div>
			) : null}
			<IconButton
				size="sm"
				className="m-1 flex-none"
				icon={<IconPlus size={16} aria-hidden="true" />}
				label={canOpenTab ? t("apiClient.tabs.new") : limit}
				title={canOpenTab ? undefined : limit}
				disabled={!canOpenTab}
				data-id="tabbar-new"
				onClick={() => {
					refocus.current = true;
					openTab();
				}}
			/>
			{ids.length > 0 ? (
				<TabOverflowMenu
					tabs={tabs}
					pages={pages}
					activeId={activeTabId}
					actions={menuActions}
				/>
			) : null}
			{trailing ? (
				<div className="ml-auto flex flex-none items-center px-1">
					{trailing}
				</div>
			) : null}
			<CloseTabModal
				open={closing.open}
				prompt={closing.prompt}
				onCancel={closing.cancel}
				onDiscard={closing.confirm}
				onCloseAutoFocus={(event) => {
					const element = latestActive.current
						? document.getElementById(tabDomId(latestActive.current))
						: null;
					if (!element) return;
					event.preventDefault();
					element.focus();
				}}
			/>
		</div>
	);
}
