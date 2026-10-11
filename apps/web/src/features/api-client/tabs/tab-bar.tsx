import { DRAFT_MAX_TABS } from "@localman/shared/api-client";
import { IconPlus } from "@tabler/icons-react";
import {
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { IconButton } from "../../../components/ui/icon-button";
import { useT } from "../../../i18n/i18n-context";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../workbench/workbench-context";
import type { WorkbenchTab } from "../workbench/workbench-types";
import { CloseTabModal } from "./close-tab-modal";
import { PageTabItem } from "./page-tab-item";
import { TabItem, tabDomId } from "./tab-item";
import { tabLabel } from "./tab-label";

/** Index of the tab a navigation key moves to, or `null` for other keys. */
function targetIndex(key: string, index: number, last: number): number | null {
	switch (key) {
		case "ArrowRight":
			return index === last ? 0 : index + 1;
		case "ArrowLeft":
			return index === 0 ? last : index - 1;
		case "Home":
			return 0;
		case "End":
			return last;
		default:
			return null;
	}
}

export interface TabBarProps {
	panelId: string;
	/** Control before the tabs (the sidebar drawer button on narrow screens). */
	leading?: ReactNode;
}

/** Open requests as tabs (←/→, Home/End, Delete to close) plus "New". */
export function TabBar({ panelId, leading }: TabBarProps) {
	const t = useT();
	const { tabs, pages, activeTabId, canOpenTab } = useWorkbenchState();
	const { activateTab, closeTab, openTab } = useWorkbenchActions();
	const [closing, setClosing] = useState<WorkbenchTab | null>(null);
	const refocus = useRef(false);
	// Handlers read the tabs here, so they stay the same for memoized tabs.
	const latestTabs = useRef(tabs);
	latestTabs.current = tabs;
	const latestIds = useRef<string[]>([]);
	latestIds.current = [...tabs, ...pages].map((item) => item.id);

	// After a keyboard switch or a close, focus follows the active tab.
	useEffect(() => {
		if (!refocus.current) return;
		refocus.current = false;
		if (activeTabId) document.getElementById(tabDomId(activeTabId))?.focus();
	}, [activeTabId]);

	const requestClose = useCallback(
		(tab: WorkbenchTab) => {
			if (tab.dirty) setClosing(tab);
			else closeTab(tab.id);
		},
		[closeTab],
	);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLButtonElement>, tabId: string) => {
			const ids = latestIds.current;
			const index = ids.indexOf(tabId);
			if (index === -1) return;
			const target = targetIndex(event.key, index, ids.length - 1);
			const tab = latestTabs.current.find((item) => item.id === tabId);
			if (target !== null) {
				event.preventDefault();
				const next = ids[target];
				if (next) {
					refocus.current = true;
					activateTab(next);
				}
			} else if (event.key === "Delete") {
				event.preventDefault();
				refocus.current = !tab?.dirty;
				if (tab) requestClose(tab);
				else closeTab(tabId);
			}
		},
		[activateTab, requestClose, closeTab],
	);

	const limit = t("apiClient.tabs.limit", { max: DRAFT_MAX_TABS });
	return (
		<div
			data-id="tabbar"
			className="flex min-w-0 items-stretch border-border-subtle border-b bg-surface-subtle"
		>
			{leading}
			{tabs.length + pages.length > 0 ? (
				<div
					role="tablist"
					aria-label={t("apiClient.tabs.label")}
					data-id="tabbar-tabs"
					className="flex min-w-0 overflow-x-auto [scrollbar-width:thin]"
				>
					{tabs.map((tab) => (
						<TabItem
							key={tab.id}
							tab={tab}
							active={tab.id === activeTabId}
							panelId={panelId}
							onSelect={activateTab}
							onClose={requestClose}
							onKeyDown={onKeyDown}
						/>
					))}
					{pages.map((page) => (
						<PageTabItem
							key={page.id}
							page={page}
							active={page.id === activeTabId}
							panelId={panelId}
							onSelect={activateTab}
							onClose={closeTab}
							onKeyDown={onKeyDown}
						/>
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
			<CloseTabModal
				tabName={
					closing
						? tabLabel(closing.draft) || t("apiClient.request.untitled")
						: null
				}
				onCancel={() => setClosing(null)}
				onDiscard={() => {
					if (closing) closeTab(closing.id);
					setClosing(null);
				}}
				onCloseAutoFocus={(event) => {
					const next = activeTabId;
					const element = next ? document.getElementById(tabDomId(next)) : null;
					if (!element) return;
					event.preventDefault();
					element.focus();
				}}
			/>
		</div>
	);
}
