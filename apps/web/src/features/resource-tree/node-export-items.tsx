import { DropdownMenuLabel } from "../../components/ui/dropdown-menu";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { ExportTypeItems } from "../resources/export-type-items";
import type { Resource } from "../resources/resource-model";

export interface NodeExportItemsProps {
	resource: Resource;
	resources: readonly Resource[];
	/** `data-id` of the section heading (the former `{}` trigger's id). */
	"data-id": string;
}

/**
 * "Export types" section of a node's ⋯ menu: the shared copy/download
 * items, with results as toasts.
 */
export function NodeExportItems({
	resource,
	resources,
	"data-id": dataId,
}: NodeExportItemsProps) {
	const t = useT();
	const toast = useToast();
	return (
		<>
			<DropdownMenuLabel data-id={dataId}>
				{t("resourceExport.trigger")}
			</DropdownMenuLabel>
			<ExportTypeItems
				resource={resource}
				resources={resources}
				onResult={(title, ok) =>
					toast.show({ title, tone: ok ? "success" : "info" })
				}
			/>
		</>
	);
}
