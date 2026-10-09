import { Suspense, lazy } from "react";
import { useToast } from "../../components/ui/toast";
import {
	DataChangesConfirmModal,
	type DataConfirm,
} from "../../features/resources/data-changes-confirm-modal";
import { DeleteResourceModal } from "../../features/resources/delete-resource-modal";
import type { Resource } from "../../features/resources/resource-model";
import { useResourceCache } from "../../features/resources/use-resources";

/*
 * The resource and data modals carry CodeMirror and the Faker catalog;
 * they load on first open so the page itself stays light.
 */
const ResourceFormModal = lazy(async () => ({
	default: (await import("../../features/resources/resource-form-modal"))
		.ResourceFormModal,
}));
const ResourceDataModal = lazy(async () => ({
	default: (await import("../../features/resources/resource-data-modal"))
		.ResourceDataModal,
}));

export type ProjectDialog =
	| { kind: "none" }
	| { kind: "form"; resource: Resource | null }
	| { kind: "data"; resource: Resource }
	| { kind: "delete"; resource: Resource }
	| { kind: "confirm"; confirm: DataConfirm };

export const NO_DIALOG: ProjectDialog = { kind: "none" };

export interface ProjectDetailDialogsProps {
	projectId: string;
	dialog: ProjectDialog;
	resources: readonly Resource[];
	canEdit: boolean;
	onClose: () => void;
	/** The owner's plan has no room for another resource. */
	onPlanLimit: () => void;
}

export function ProjectDetailDialogs({
	projectId,
	dialog,
	resources,
	canEdit,
	onClose,
	onPlanLimit,
}: ProjectDetailDialogsProps) {
	const toast = useToast();
	const cache = useResourceCache(projectId);
	const closeOnFalse = (open: boolean) => {
		if (!open) onClose();
	};

	switch (dialog.kind) {
		case "form":
			return (
				<Suspense fallback={null}>
					<ResourceFormModal
						projectId={projectId}
						resource={dialog.resource}
						resources={resources}
						onOpenChange={closeOnFalse}
						onPlanLimit={onPlanLimit}
						onSaved={(saved, created) => {
							onClose();
							void cache.invalidate();
							toast.show({
								title: (
									<>
										{created ? "Đã tạo resource" : "Đã cập nhật resource"}{" "}
										<b className="font-mono">{saved.name}</b>.
									</>
								),
								description: created
									? "Bấm vào thanh xám để sinh dữ liệu."
									: undefined,
							});
						}}
					/>
				</Suspense>
			);
		case "data":
			return (
				<Suspense fallback={null}>
					<ResourceDataModal
						projectId={projectId}
						resource={dialog.resource}
						resources={resources}
						readOnly={!canEdit}
						onOpenChange={closeOnFalse}
						onUpdated={(resource, changes) => {
							onClose();
							cache.applyChanges(changes);
							const count = changes.find(
								(change) => change.resourceId === resource.id,
							)?.countAfter;
							toast.show({
								title: "Đã cập nhật dữ liệu",
								description: (
									<>
										{count === undefined ? null : (
											<>
												<b>{count}</b> bản ghi cho{" "}
											</>
										)}
										<b className="font-mono">{resource.name}</b>.
									</>
								),
							});
						}}
					/>
				</Suspense>
			);
		case "delete":
			return (
				<DeleteResourceModal
					projectId={projectId}
					resource={dialog.resource}
					onOpenChange={closeOnFalse}
					onDeleted={(gone) => {
						void cache.invalidate();
						toast.show({
							title: (
								<>
									Đã xoá resource <b className="font-mono">{gone.name}</b>.
								</>
							),
						});
					}}
				/>
			);
		case "confirm":
			return (
				<DataChangesConfirmModal
					confirm={dialog.confirm}
					onOpenChange={closeOnFalse}
				/>
			);
		default:
			return null;
	}
}
