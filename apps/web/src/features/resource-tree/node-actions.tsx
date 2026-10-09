import type { ReactNode } from "react";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

export type NodeAction = "edit" | "data" | "delete";

export interface NodeActionsProps {
	name: string;
	onAction: (action: NodeAction) => void;
	/** `data-id` of the node; buttons append `-edit`, `-data`, `-delete`. */
	dataIdBase: string;
	/** Pushed to the end of the row (the "Export types" menu). */
	trailing?: ReactNode;
}

const ACTION_CLASS =
	"relative cursor-pointer rounded-xs border-0 bg-transparent px-1.5 py-1 font-mono font-semibold text-xs leading-[1.55] " +
	"transition-[background-color,color] hover:bg-fg/6 " +
	// Taller hit area on touch screens without moving the layout.
	"pointer-coarse:before:-inset-y-2 before:absolute before:inset-x-0 before:content-['']";

/**
 * Edit / Data / Delete row of a resource node. Hidden until the node is
 * hovered or holds focus; always visible on touch screens, which have no
 * hover.
 */
export function NodeActions({
	name,
	onAction,
	dataIdBase,
	trailing,
}: NodeActionsProps) {
	const t = useT();
	return (
		<div
			className={cn(
				"-ml-1.5 mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity",
				"group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100",
			)}
		>
			<button
				type="button"
				aria-label={t("resourceTree.node.editLabel", { name })}
				data-id={`${dataIdBase}-edit`}
				className={cn(ACTION_CLASS, "text-muted hover:text-fg")}
				onClick={() => onAction("edit")}
			>
				{t("resourceTree.node.edit")}
			</button>
			<button
				type="button"
				aria-label={t("resourceTree.node.dataLabel", { name })}
				data-id={`${dataIdBase}-data`}
				className={cn(ACTION_CLASS, "text-muted hover:text-fg")}
				onClick={() => onAction("data")}
			>
				{t("resourceTree.node.data")}
			</button>
			<button
				type="button"
				aria-label={t("resourceTree.node.deleteLabel", { name })}
				data-id={`${dataIdBase}-delete`}
				className={cn(ACTION_CLASS, "text-error")}
				onClick={() => onAction("delete")}
			>
				{t("resourceTree.node.delete")}
			</button>
			{trailing}
		</div>
	);
}
