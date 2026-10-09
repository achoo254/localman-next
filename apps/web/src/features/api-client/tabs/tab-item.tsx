import { IconX } from "@tabler/icons-react";
import { type KeyboardEvent, memo } from "react";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { METHOD_TEXT_CLASS, methodShortLabel } from "../../../lib/method-tone";
import type { WorkbenchTab } from "../workbench/workbench-types";
import { tabLabel } from "./tab-label";

export interface TabItemProps {
	tab: WorkbenchTab;
	active: boolean;
	/** Id of the panel the tabs control. */
	panelId: string;
	/** Handlers take the tab, so the bar passes the same ones to every tab. */
	onSelect: (tabId: string) => void;
	onClose: (tab: WorkbenchTab) => void;
	onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tabId: string) => void;
}

export const tabDomId = (tabId: string) => `api-client-tab-${tabId}`;

/**
 * One open request. The close cross is a mouse target only (a button
 * inside a tab is not allowed); keyboard users press Delete on the tab.
 * Memoized: typing in one tab re-renders that tab only.
 */
export const TabItem = memo(function TabItem({
	tab,
	active,
	panelId,
	onSelect,
	onClose,
	onKeyDown,
}: TabItemProps) {
	const t = useT();
	const label = tabLabel(tab.draft) || t("apiClient.request.untitled");
	return (
		<div
			role="presentation"
			className={cn(
				"group relative flex min-w-28 max-w-56 flex-none items-center border-border-subtle border-r",
				active
					? "bg-surface text-fg"
					: "text-muted hover:bg-fg/4 hover:text-fg",
				active &&
					"before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary",
			)}
			onAuxClick={(event) => {
				if (event.button === 1) onClose(tab);
			}}
		>
			<button
				type="button"
				role="tab"
				id={tabDomId(tab.id)}
				aria-selected={active}
				aria-controls={panelId}
				aria-keyshortcuts="Delete"
				tabIndex={active ? 0 : -1}
				title={label}
				data-id="tabbar-tab"
				className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-0 bg-transparent pr-1 pl-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2"
				onClick={() => onSelect(tab.id)}
				onKeyDown={(event) => onKeyDown(event, tab.id)}
			>
				<span
					className={cn(
						"flex-none font-bold font-mono text-[0.625rem]",
						METHOD_TEXT_CLASS[tab.draft.method],
					)}
				>
					{methodShortLabel(tab.draft.method)}
				</span>
				<span className="min-w-0 flex-1 truncate">{label}</span>
				{tab.dirty ? (
					<span
						data-id="tabbar-tab-dirty"
						className="size-2 flex-none rounded-full bg-accent"
					>
						<span className="sr-only">{t("apiClient.tabs.unsaved")}</span>
					</span>
				) : null}
			</button>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer shortcut only; the tab itself closes with Delete (aria-keyshortcuts). */}
			<span
				aria-hidden="true"
				data-id="tabbar-tab-close"
				title={t("apiClient.tabs.close")}
				className="mr-1 grid size-6 flex-none cursor-pointer place-items-center rounded-xs text-icon-muted hover:bg-fg/8 hover:text-fg"
				onClick={() => onClose(tab)}
			>
				<IconX size={14} />
			</span>
		</div>
	);
});
