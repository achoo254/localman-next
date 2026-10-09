import { cn } from "../../lib/cn";

export type NodeAction = "edit" | "data" | "delete";

export interface NodeActionsProps {
	name: string;
	onAction: (action: NodeAction) => void;
	/** `data-id` of the node; buttons append `-edit`, `-data`, `-delete`. */
	dataIdBase: string;
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
export function NodeActions({ name, onAction, dataIdBase }: NodeActionsProps) {
	return (
		<div
			className={cn(
				"-ml-1.5 mt-1.5 flex gap-0.5 opacity-0 transition-opacity",
				"group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100",
			)}
		>
			<button
				type="button"
				aria-label={`Sửa ${name}`}
				data-id={`${dataIdBase}-edit`}
				className={cn(ACTION_CLASS, "text-muted hover:text-fg")}
				onClick={() => onAction("edit")}
			>
				Sửa
			</button>
			<button
				type="button"
				aria-label={`Dữ liệu ${name}`}
				data-id={`${dataIdBase}-data`}
				className={cn(ACTION_CLASS, "text-muted hover:text-fg")}
				onClick={() => onAction("data")}
			>
				Dữ liệu
			</button>
			<button
				type="button"
				aria-label={`Xoá ${name}`}
				data-id={`${dataIdBase}-delete`}
				className={cn(ACTION_CLASS, "text-error")}
				onClick={() => onAction("delete")}
			>
				Xoá
			</button>
		</div>
	);
}
