import { IconDots, IconSend, IconTrash } from "@tabler/icons-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import type { Resource } from "../resources/resource-model";
import { NodeExportItems } from "./node-export-items";

export interface NodeMoreMenuProps {
	name: string;
	/** `data-id` of the node; entries append `-more`, `-client`, `-types`, `-delete`. */
	dataIdBase: string;
	tabIndex: 0 | -1;
	/** Class of the ⋯ trigger, matching the node's action row. */
	triggerClassName: string;
	onDelete: () => void;
	/** "API Client" entry; absent hides it. */
	onOpenInClient?: () => void;
	/** "Export types" section; absent hides it. */
	exportOf?: { resource: Resource; resources: readonly Resource[] };
}

/**
 * ⋯ menu of a resource node: API Client, Export types and, last and set
 * apart, Delete (which still asks for confirmation on the page).
 */
export function NodeMoreMenu({
	name,
	dataIdBase: base,
	tabIndex,
	triggerClassName,
	onDelete,
	onOpenInClient,
	exportOf,
}: NodeMoreMenuProps) {
	const t = useT();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={t("resourceTree.node.moreLabel", { name })}
				data-id={`${base}-more`}
				tabIndex={tabIndex}
				className={triggerClassName}
			>
				<IconDots size={16} aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent data-id={`${base}-menu`} className="max-w-80">
				{onOpenInClient ? (
					<DropdownMenuItem
						data-id={`${base}-client`}
						aria-label={t("apiClientOpen.node.aria", { name })}
						icon={<IconSend size={16} aria-hidden="true" />}
						className="pointer-coarse:min-h-11"
						onSelect={onOpenInClient}
					>
						{t("apiClientOpen.node.label")}
					</DropdownMenuItem>
				) : null}
				{onOpenInClient && exportOf ? <DropdownMenuSeparator /> : null}
				{exportOf ? (
					<NodeExportItems
						resource={exportOf.resource}
						resources={exportOf.resources}
						data-id={`${base}-types`}
					/>
				) : null}
				{onOpenInClient || exportOf ? <DropdownMenuSeparator /> : null}
				<DropdownMenuItem
					danger
					data-id={`${base}-delete`}
					aria-label={t("resourceTree.node.deleteLabel", { name })}
					icon={<IconTrash size={16} aria-hidden="true" />}
					className="pointer-coarse:min-h-11"
					onSelect={onDelete}
				>
					{t("resourceTree.node.delete")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
