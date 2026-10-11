import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { BulkDeleteModal } from "./bulk-delete-modal";
import { planBulkDelete } from "./bulk-plan";
import type { TreeRow } from "./tree-rows";

export interface BulkBarProps {
	workspaceId: string;
	picked: readonly TreeRow[];
	onClear: () => void;
}

/** Over the tree while rows are picked: how many, Clear and Delete. */
export function BulkBar({ workspaceId, picked, onClear }: BulkBarProps) {
	const t = useT();
	const [deleting, setDeleting] = useState(false);
	const plan = planBulkDelete(picked);
	return (
		<div
			role="toolbar"
			aria-label={t("collections.bulk.bar")}
			data-id="sidebar-bulk-bar"
			className="sticky top-0 z-10 flex items-center gap-1 border-border-subtle border-b bg-surface-subtle px-3 py-1.5"
		>
			<output className="min-w-0 flex-1 truncate font-semibold text-xs">
				{t("collections.bulk.selected", { count: picked.length })}
			</output>
			<Button
				size="sm"
				variant="ghost"
				data-id="sidebar-bulk-clear"
				onClick={onClear}
			>
				{t("collections.bulk.clear")}
			</Button>
			<Button
				size="sm"
				variant="danger"
				data-id="sidebar-bulk-delete"
				onClick={() => setDeleting(true)}
			>
				<IconTrash size={14} aria-hidden="true" />
				{t("collections.bulk.delete")}
			</Button>
			{deleting ? (
				<BulkDeleteModal
					workspaceId={workspaceId}
					plan={plan}
					open
					onOpenChange={setDeleting}
					onDone={onClear}
				/>
			) : null}
		</div>
	);
}
