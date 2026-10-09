import type { ReactNode } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { formatNumber } from "../../lib/format";
import type { DataChange } from "./resource-model";

/** A write previewed with a dry run, waiting for the user's go-ahead. */
export interface DataConfirm {
	title: string;
	question: ReactNode;
	/** Sentence above the list of resources whose data changes. */
	lead: string;
	confirmLabel: string;
	changes: DataChange[];
	"data-id": string;
	run: () => Promise<void>;
}

export interface DataChangesConfirmModalProps {
	confirm: DataConfirm;
	onOpenChange: (open: boolean) => void;
}

/** Confirmation listing what a dry run says the write will change. */
export function DataChangesConfirmModal({
	confirm,
	onOpenChange,
}: DataChangesConfirmModalProps) {
	const dataId = confirm["data-id"];
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
			<div>
				{confirm.lead}
				<ul data-id={`${dataId}-changes`} className="m-0 mt-1 list-disc pl-5">
					{confirm.changes.map((change) => (
						<li key={change.resourceId}>
							<span className="font-mono">{change.name}</span>:{" "}
							{formatNumber(change.countBefore)} →{" "}
							{formatNumber(change.countAfter)} bản ghi
						</li>
					))}
				</ul>
			</div>
		</ConfirmModal>
	);
}
