import type { ImportedFolder, ImportedItem } from "@localman/shared/api-client";
import { IconChevronRight, IconFolder } from "@tabler/icons-react";
import { cn } from "../../lib/cn";
import { METHOD_TEXT_CLASS, methodShortLabel } from "../../lib/method-tone";

export interface TreeRow {
	item: ImportedItem;
	/** 1 for a top-level item (`aria-level`). */
	depth: number;
	parentId: string | null;
	/** Position among its siblings (`aria-posinset`, `aria-setsize`). */
	position: number;
	siblings: number;
}

/** The rows on screen: every item whose folders are all open, in order. */
export function visibleRows(
	items: readonly ImportedItem[],
	expanded: ReadonlySet<string>,
	depth = 1,
	parentId: string | null = null,
): TreeRow[] {
	return items.flatMap((item, index) => {
		const row: TreeRow = {
			item,
			depth,
			parentId,
			position: index + 1,
			siblings: items.length,
		};
		return item.kind === "folder" && expanded.has(item.id)
			? [row, ...visibleRows(item.items, expanded, depth + 1, item.id)]
			: [row];
	});
}

export const isFolder = (item: ImportedItem): item is ImportedFolder =>
	item.kind === "folder";

/** Chevron and folder icon, or the request's method. */
export function RowLead({ item, open }: { item: ImportedItem; open: boolean }) {
	if (item.kind === "request") {
		return (
			<span
				className={cn(
					"ml-1 w-9 flex-none font-bold font-mono text-[0.625rem]",
					METHOD_TEXT_CLASS[item.draft.method],
				)}
			>
				{methodShortLabel(item.draft.method)}
			</span>
		);
	}
	return (
		<>
			<IconChevronRight
				size={14}
				aria-hidden="true"
				className={cn(
					"ml-1 flex-none text-icon-muted transition-transform duration-(--dur-fast)",
					open && "rotate-90",
				)}
			/>
			<IconFolder
				size={16}
				aria-hidden="true"
				className="flex-none text-icon-muted"
			/>
		</>
	);
}
