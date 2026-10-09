import { useEffect, useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { formatNumber } from "../../lib/format";
import { localizedError } from "./resource-errors";
import type { Resource } from "./resource-model";
import { type RemovedResource, deleteResource } from "./resources-api";

export interface DeleteResourceModalProps {
	projectId: string;
	resource: Resource;
	onOpenChange: (open: boolean) => void;
	onDeleted: (resource: Resource) => void;
}

type Preview =
	| { status: "loading" }
	| { status: "ready"; removed: RemovedResource[] }
	| { status: "unavailable" };

const records = (count: number) => `${formatNumber(count)} bản ghi`;

/**
 * Asks the API for a dry run first to list the child resources that go
 * with this one (cascade), then deletes for real. Mount it only while open.
 */
export function DeleteResourceModal({
	projectId,
	resource,
	onOpenChange,
	onDeleted,
}: DeleteResourceModalProps) {
	const [preview, setPreview] = useState<Preview>({ status: "loading" });

	useEffect(() => {
		let active = true;
		deleteResource(projectId, resource.id, true).then(
			(removed) => active && setPreview({ status: "ready", removed }),
			// The warning still stands without the list; the real delete
			// reports its own error.
			() => active && setPreview({ status: "unavailable" }),
		);
		return () => {
			active = false;
		};
	}, [projectId, resource.id]);

	const children =
		preview.status === "ready"
			? preview.removed.filter((item) => item.resourceId !== resource.id)
			: [];

	return (
		<ConfirmModal
			open
			onOpenChange={onOpenChange}
			title="Xoá resource"
			data-id="modal-delete-resource"
			question={
				<>
					Xoá “<span className="font-mono">{resource.name}</span>”?
				</>
			}
			confirmLabel="Xoá resource"
			confirmDisabled={preview.status === "loading"}
			onConfirm={async () => {
				try {
					await deleteResource(projectId, resource.id, false);
				} catch (error) {
					throw localizedError(error);
				}
				onDeleted(resource);
			}}
		>
			<span>
				Schema, endpoint và {records(resource.count)} của {resource.name} sẽ bị
				xoá.
			</span>
			{preview.status === "loading" ? (
				<span>Đang kiểm tra resource con…</span>
			) : null}
			{preview.status === "unavailable" ? (
				<span data-id="modal-delete-resource-cascade">
					Mọi resource con và dữ liệu của chúng cũng bị xoá.
				</span>
			) : null}
			{children.length > 0 ? (
				<div data-id="modal-delete-resource-cascade">
					Sẽ xoá kèm {children.length} resource con:
					<ul className="m-0 mt-1 list-disc pl-5">
						{children.map((child) => (
							<li key={child.resourceId}>
								<span className="font-mono">{child.name}</span> (
								{records(child.count)})
							</li>
						))}
					</ul>
				</div>
			) : null}
			<span>Hành động này không thể hoàn tác.</span>
		</ConfirmModal>
	);
}
