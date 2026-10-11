import { IconFolder, IconStack2, IconX } from "@tabler/icons-react";
import { type KeyboardEvent, memo } from "react";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import type { PageTab } from "../workbench/workbench-tab-types";
import { tabDomId } from "./tab-item";

export interface PageTabItemProps {
	page: PageTab;
	active: boolean;
	panelId: string;
	onSelect: (tabId: string) => void;
	onClose: (tabId: string) => void;
	onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tabId: string) => void;
}

/** A collection or folder in the tab bar; it saves itself, so it closes at once. */
export const PageTabItem = memo(function PageTabItem({
	page,
	active,
	panelId,
	onSelect,
	onClose,
	onKeyDown,
}: PageTabItemProps) {
	const t = useT();
	const Icon = page.kind === "collection" ? IconStack2 : IconFolder;
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
				if (event.button === 1) onClose(page.id);
			}}
		>
			<button
				type="button"
				role="tab"
				id={tabDomId(page.id)}
				aria-selected={active}
				aria-controls={panelId}
				aria-keyshortcuts="Delete"
				tabIndex={active ? 0 : -1}
				title={page.name}
				data-id={`tabbar-tab-${page.kind}`}
				className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-0 bg-transparent pr-1 pl-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2"
				onClick={() => onSelect(page.id)}
				onKeyDown={(event) => onKeyDown(event, page.id)}
			>
				<Icon
					size={14}
					aria-hidden="true"
					className="flex-none text-icon-muted"
				/>
				<span className="sr-only">
					{t(`collections.page.kind.${page.kind}`)}
				</span>
				<span className="min-w-0 flex-1 truncate">{page.name}</span>
			</button>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: pointer shortcut only; the tab itself closes with Delete (aria-keyshortcuts). */}
			<span
				aria-hidden="true"
				data-id="tabbar-tab-close"
				title={t("apiClient.tabs.close")}
				className="mr-1 grid size-6 flex-none cursor-pointer place-items-center rounded-xs text-icon-muted hover:bg-fg/8 hover:text-fg"
				onClick={() => onClose(page.id)}
			>
				<IconX size={14} />
			</span>
		</div>
	);
});
