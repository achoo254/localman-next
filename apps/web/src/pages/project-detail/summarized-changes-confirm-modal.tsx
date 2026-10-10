import { ConfirmModal } from "../../components/ui/confirm-modal";
import type { DataConfirm } from "../../features/resources/data-changes-confirm-modal";
import type { DataChange } from "../../features/resources/resource-model";
import { useT } from "../../i18n/i18n-context";

/** Record totals over every listed resource, before and after the write. */
export function changeTotals(changes: readonly DataChange[]): {
	before: number;
	after: number;
} {
	let before = 0;
	let after = 0;
	for (const change of changes) {
		before += change.countBefore;
		after += change.countAfter;
	}
	return { before, after };
}

export interface SummarizedChangesConfirmModalProps {
	confirm: DataConfirm;
	onOpenChange: (open: boolean) => void;
}

/**
 * Confirmation of a project-wide write (Generate all): one summary line,
 * "16 resources, 400 → 400 records", with the per-resource lines folded
 * in a `<details>` so 50 resources do not stretch the dialog.
 */
export function SummarizedChangesConfirmModal({
	confirm,
	onOpenChange,
}: SummarizedChangesConfirmModalProps) {
	const t = useT();
	const dataId = confirm["data-id"];
	const { before, after } = changeTotals(confirm.changes);
	return (
		<ConfirmModal
			open
			onOpenChange={onOpenChange}
			title={confirm.title}
			question={confirm.question}
			confirmLabel={confirm.confirmLabel}
			onConfirm={confirm.run}
			data-id={dataId}
		>
			<div className="grid gap-1">
				<p className="m-0">{confirm.lead}</p>
				<p data-id={`${dataId}-summary`} className="m-0 font-semibold">
					{t("projectDetail.generateAll.summary", {
						resources: t("projectDetail.resources.count", {
							count: confirm.changes.length,
						}),
						records: t("resources.changeLine", { before, count: after }),
					})}
				</p>
				<details data-id={`${dataId}-details`}>
					<summary className="cursor-pointer font-mono text-muted">
						{t("projectDetail.generateAll.details")}
					</summary>
					<ul data-id={`${dataId}-changes`} className="m-0 mt-1 list-disc pl-5">
						{confirm.changes.map((change) => (
							<li key={change.resourceId}>
								<span className="font-mono">{change.name}</span>:{" "}
								{t("resources.changeLine", {
									before: change.countBefore,
									count: change.countAfter,
								})}
							</li>
						))}
					</ul>
				</details>
			</div>
		</ConfirmModal>
	);
}
