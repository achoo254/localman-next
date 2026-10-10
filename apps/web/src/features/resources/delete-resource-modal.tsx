import { useEffect, useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
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

const MONO = {
	code: (chunk: string) => <span className="font-mono">{chunk}</span>,
};

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
	const t = useT();
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

	const checking = useDelayedFlag(preview.status === "loading");
	const children =
		preview.status === "ready" && !checking
			? preview.removed.filter((item) => item.resourceId !== resource.id)
			: [];

	return (
		<ConfirmModal
			open
			onOpenChange={onOpenChange}
			title={t("resources.delete.title")}
			data-id="modal-delete-resource"
			question={renderRich(
				t("resources.delete.question", { name: resource.name }),
				MONO,
			)}
			confirmLabel={t("resources.delete.confirm")}
			confirmDisabled={preview.status === "loading"}
			onConfirm={async () => {
				try {
					await deleteResource(projectId, resource.id, false);
				} catch (error) {
					throw localizedError(error, t);
				}
				onDeleted(resource);
			}}
		>
			<span>
				{t("resources.delete.body", {
					count: resource.count,
					name: resource.name,
				})}
			</span>
			{checking ? (
				<SkeletonRegion
					data-id="modal-delete-resource-checking"
					label={t("resources.delete.checking")}
				>
					<Skeleton variant="text" lines={2} className="max-w-xs" />
				</SkeletonRegion>
			) : null}
			{preview.status === "unavailable" && !checking ? (
				<span data-id="modal-delete-resource-cascade">
					{t("resources.delete.cascadeUnknown")}
				</span>
			) : null}
			{children.length > 0 ? (
				<div data-id="modal-delete-resource-cascade">
					{t("resources.delete.cascade", { count: children.length })}
					<ul className="m-0 mt-1 list-disc pl-5">
						{children.map((child) => (
							<li key={child.resourceId}>
								<span className="font-mono">{child.name}</span> (
								{t("resources.records", { count: child.count })})
							</li>
						))}
					</ul>
				</div>
			) : null}
			<span>{t("resources.delete.irreversible")}</span>
		</ConfirmModal>
	);
}
