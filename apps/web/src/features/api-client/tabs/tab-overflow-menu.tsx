import type { HttpMethod } from "@localman/shared/api-client";
import { IconDots } from "@tabler/icons-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { IconButton } from "../../../components/ui/icon-button";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { METHOD_TEXT_CLASS, methodShortLabel } from "../../../lib/method-tone";
import type { PageTab } from "../workbench/workbench-tab-types";
import type { WorkbenchTab } from "../workbench/workbench-types";
import type { TabMenuActions } from "./tab-context-menu";
import { tabLabel } from "./tab-label";

interface TabEntry {
	id: string;
	label: string;
	/** Requests only. */
	method?: HttpMethod;
	dirty: boolean;
}

export interface TabOverflowMenuProps {
	tabs: readonly WorkbenchTab[];
	pages: readonly PageTab[];
	activeId: string | null;
	actions: Pick<TabMenuActions, "onActivate" | "onClose" | "onCloseAutoFocus">;
}

/**
 * "…" at the end of the tab bar: every open tab to jump to (the bar
 * scrolls past them) and the bulk closes, without needing right click.
 */
export function TabOverflowMenu(props: TabOverflowMenuProps) {
	const t = useT();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<IconButton
					size="sm"
					className="m-1 flex-none"
					icon={<IconDots size={16} aria-hidden="true" />}
					label={t("apiClient.tabs.more")}
					data-id="tabbar-more"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				data-id="tabbar-more-menu"
				className="max-h-[min(70vh,32rem)] max-w-80 overflow-y-auto"
				onCloseAutoFocus={props.actions.onCloseAutoFocus}
			>
				<OverflowItems {...props} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Mounted only while the menu is open: typing in a tab never builds it. */
function OverflowItems({
	tabs,
	pages,
	activeId,
	actions,
}: TabOverflowMenuProps) {
	const t = useT();
	// In bar order: requests, then pages.
	const entries: TabEntry[] = [
		...tabs.map((tab) => ({
			id: tab.id,
			label: tabLabel(tab.draft) || t("apiClient.request.untitled"),
			method: tab.draft.method,
			dirty: tab.dirty,
		})),
		...pages.map((page) => ({ id: page.id, label: page.name, dirty: false })),
	];
	const unchanged = entries
		.filter((entry) => !entry.dirty)
		.map((entry) => entry.id);
	return (
		<>
			<DropdownMenuLabel>
				{t("apiClient.tabs.openList", { count: entries.length })}
			</DropdownMenuLabel>
			<DropdownMenuRadioGroup
				value={activeId ?? ""}
				onValueChange={actions.onActivate}
			>
				{entries.map((entry) => (
					<DropdownMenuRadioItem
						key={entry.id}
						value={entry.id}
						data-id="tabbar-more-tab"
					>
						{entry.method ? (
							<span
								className={cn(
									"flex-none font-bold text-[0.625rem]",
									METHOD_TEXT_CLASS[entry.method],
								)}
							>
								{methodShortLabel(entry.method)}
							</span>
						) : null}
						<span className="min-w-0 flex-1 truncate">{entry.label}</span>
						{entry.dirty ? (
							<span className="size-2 flex-none rounded-full bg-accent">
								<span className="sr-only">{t("apiClient.tabs.unsaved")}</span>
							</span>
						) : null}
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
			<DropdownMenuSeparator />
			<DropdownMenuItem
				disabled={unchanged.length === 0}
				data-id="tabbar-more-close-unchanged"
				onSelect={() => actions.onClose(unchanged)}
			>
				{t("apiClient.tabs.closeUnchanged")}
			</DropdownMenuItem>
			<DropdownMenuItem
				data-id="tabbar-more-close-all"
				onSelect={() => actions.onClose(entries.map((entry) => entry.id))}
			>
				{t("apiClient.tabs.closeAll")}
			</DropdownMenuItem>
		</>
	);
}
