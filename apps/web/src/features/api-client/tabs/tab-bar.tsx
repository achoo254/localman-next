import { DRAFT_MAX_TABS } from "@localman/shared/api-client";
import { IconPlus } from "@tabler/icons-react";
import {
	type KeyboardEvent,
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

/** Open requests as tabs (←/→, Home/End, Delete to close) plus "New". */
export function TabBar({ panelId }: { panelId: string }) {
	const t = useT();
	const { tabs, activeTabId, canOpenTab } = useWorkbenchState();
	const { activateTab, closeTab, openTab } = useWorkbenchActions();
	const [closing, setClosing] = useState<WorkbenchTab | null>(null);
	const refocus = useRef(false);
	// Handlers read the tabs here, so they stay the same for memoized tabs.
	const latestTabs = useRef(tabs);
	latestTabs.current = tabs;

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
			const all = latestTabs.current;
			const index = all.findIndex((item) => item.id === tabId);
			const tab = all[index];
			if (!tab) return;
			const target = targetIndex(event.key, index, all.length - 1);
			if (target !== null) {
				event.preventDefault();
				const next = all[target];
				if (next) {
					refocus.current = true;
					activateTab(next.id);
				}
			} else if (event.key === "Delete") {
				event.preventDefault();
				refocus.current = !tab.dirty;
				requestClose(tab);
			}
		},
		[activateTab, requestClose],
	);

	const limit = t("apiClient.tabs.limit", { max: DRAFT_MAX_TABS });
	return (
		<div
			data-id="tabbar"
			className="flex min-w-0 items-stretch border-border-subtle border-b bg-surface-subtle"
		>
			{tabs.length > 0 ? (
				<div
					role="tablist"
					aria-label={t("apiClient.tabs.label")}
					data-id="tabbar-tabs"
					className="flex min-w-0 overflow-x-auto"
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
