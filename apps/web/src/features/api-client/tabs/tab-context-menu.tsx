import type { ReactNode } from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../../../components/ui/context-menu";
import { useT } from "../../../i18n/i18n-context";

/** What the tab menus do; ids are closed through the unsaved-changes check. */
export interface TabMenuActions {
	canOpenTab: boolean;
	onNew: () => void;
	onDuplicate: (tabId: string) => void;
	onClose: (ids: readonly string[]) => void;
	onActivate: (tabId: string) => void;
	/** Restores focus to the active tab once a menu action ran. */
	onCloseAutoFocus: (event: Event) => void;
}

export interface TabContextMenuProps {
	tabId: string;
	/** Every tab and page id, in bar order. */
	ids: readonly string[];
	/** Requests can be duplicated; collection and folder pages cannot. */
	duplicable: boolean;
	actions: TabMenuActions;
	children: ReactNode;
}

/** Right-click (or ContextMenu key) menu of one tab, as in Postman. */
export function TabContextMenu({
	tabId,
	ids,
	duplicable,
	actions,
	children,
}: TabContextMenuProps) {
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div role="presentation" className="contents">
					{children}
				</div>
			</ContextMenuTrigger>
			<TabMenuContent
				tabId={tabId}
				ids={ids}
				duplicable={duplicable}
				actions={actions}
			/>
		</ContextMenu>
	);
}

/** Mounted only while the menu is open, so tabs stay cheap to render. */
function TabMenuContent({
	tabId,
	ids,
	duplicable,
	actions,
}: Omit<TabContextMenuProps, "children">) {
	const t = useT();
	const index = ids.indexOf(tabId);
	const others = ids.filter((id) => id !== tabId);
	const right = index === -1 ? [] : ids.slice(index + 1);
	return (
		<ContextMenuContent
			data-id="tabbar-tab-menu"
			onCloseAutoFocus={actions.onCloseAutoFocus}
		>
			<ContextMenuItem
				disabled={!actions.canOpenTab}
				data-id="tabbar-menu-new"
				onSelect={actions.onNew}
			>
				{t("apiClient.tabs.new")}
			</ContextMenuItem>
			{duplicable ? (
				<ContextMenuItem
					disabled={!actions.canOpenTab}
					data-id="tabbar-menu-duplicate"
					onSelect={() => actions.onDuplicate(tabId)}
				>
					{t("apiClient.tabs.duplicate")}
				</ContextMenuItem>
			) : null}
			<ContextMenuSeparator />
			<ContextMenuItem
				data-id="tabbar-menu-close"
				onSelect={() => actions.onClose([tabId])}
			>
				{t("apiClient.tabs.closeOne")}
			</ContextMenuItem>
			<ContextMenuItem
				disabled={others.length === 0}
				data-id="tabbar-menu-close-others"
				onSelect={() => actions.onClose(others)}
			>
				{t("apiClient.tabs.closeOthers")}
			</ContextMenuItem>
			<ContextMenuItem
				disabled={right.length === 0}
				data-id="tabbar-menu-close-right"
				onSelect={() => actions.onClose(right)}
			>
				{t("apiClient.tabs.closeRight")}
			</ContextMenuItem>
			<ContextMenuItem
				data-id="tabbar-menu-close-all"
				onSelect={() => actions.onClose(ids)}
			>
				{t("apiClient.tabs.closeAll")}
			</ContextMenuItem>
		</ContextMenuContent>
	);
}
