import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import type { Resource } from "../resources/resource-model";
import { NodeMoreMenu } from "./node-more-menu";

export type NodeAction = "edit" | "data" | "delete";

export interface NodeActionsProps {
	name: string;
	onAction: (action: NodeAction) => void;
	/** `data-id` of the node; controls append `-edit`, `-data`, `-more` (menu: `-client`, `-types`, `-delete`). */
	dataIdBase: string;
	/** 0 while focus is in the node (Tab reaches the row), else -1. */
	tabIndex: 0 | -1;
	/** "API Client" in the ⋯ menu (the resource's list request in a new tab). */
	onOpenInClient?: () => void;
	/** "Export types" in the ⋯ menu; absent hides it. */
	exportOf?: { resource: Resource; resources: readonly Resource[] };
}

const ACTION_BASE =
	"relative cursor-pointer rounded-xs border-0 bg-transparent text-muted transition-[background-color,color] hover:bg-fg/6 hover:text-fg " +
	// Taller hit area on touch screens without moving the layout.
	"pointer-coarse:before:-inset-y-2 before:absolute before:inset-x-0 before:content-['']";

const TEXT_ACTION = cn(
	ACTION_BASE,
	"whitespace-nowrap px-1.5 py-1 font-mono font-semibold text-xs leading-[1.55]",
);

const MORE_TRIGGER = cn(
	ACTION_BASE,
	"ml-auto inline-flex size-7 flex-none items-center justify-center data-[state=open]:bg-fg/6 data-[state=open]:text-fg",
);

/**
 * Edit / Data / ⋯ row of a resource node; API Client, Export types and
 * Delete live in the ⋯ menu so the row fits the 208px card in every
 * language. Hidden until the node is hovered, holds focus (its tree item
 * or a control) or has its menu open; always visible on touch screens,
 * which have no hover.
 */
export function NodeActions({
	name,
	onAction,
	dataIdBase,
	tabIndex,
	onOpenInClient,
	exportOf,
}: NodeActionsProps) {
	const t = useT();
	return (
		<div
			className={cn(
				"-ml-1.5 mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity",
				"group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100",
				"group-data-[focused=true]:opacity-100 has-[[data-state=open]]:opacity-100",
			)}
		>
			<button
				type="button"
				aria-label={t("resourceTree.node.editLabel", { name })}
				data-id={`${dataIdBase}-edit`}
				tabIndex={tabIndex}
				className={TEXT_ACTION}
				onClick={() => onAction("edit")}
			>
				{t("resourceTree.node.edit")}
			</button>
			<button
				type="button"
				aria-label={t("resourceTree.node.dataLabel", { name })}
				data-id={`${dataIdBase}-data`}
				tabIndex={tabIndex}
				className={TEXT_ACTION}
				onClick={() => onAction("data")}
			>
				{t("resourceTree.node.data")}
			</button>
			<NodeMoreMenu
				name={name}
				dataIdBase={dataIdBase}
				tabIndex={tabIndex}
				triggerClassName={MORE_TRIGGER}
				onDelete={() => onAction("delete")}
				onOpenInClient={onOpenInClient}
				exportOf={exportOf}
			/>
		</div>
	);
}
