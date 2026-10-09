import { Suspense, lazy } from "react";
import { useToast } from "../../components/ui/toast";
import {
	DataChangesConfirmModal,
	type DataConfirm,
} from "../../features/resources/data-changes-confirm-modal";
import { DeleteResourceModal } from "../../features/resources/delete-resource-modal";
import type { Resource } from "../../features/resources/resource-model";
import { useResourceCache } from "../../features/resources/use-resources";
import { useT } from "../../i18n/i18n-context";
import { toastText } from "./toast-text";

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
	onClose: () => void;
	/** The owner's plan has no room for another resource. */
	onPlanLimit: () => void;
}

export function ProjectDetailDialogs({
	projectId,
	dialog,
	resources,
	onClose,
	onPlanLimit,
}: ProjectDetailDialogsProps) {
	const t = useT();
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
								title: toastText(
									created
										? t("projectDetail.toast.created", { name: saved.name })
										: t("projectDetail.toast.updated", { name: saved.name }),
								),
								description: created
									? t("projectDetail.toast.createdHint")
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
						onOpenChange={closeOnFalse}
						onUpdated={(resource, changes) => {
							onClose();
							cache.applyChanges(changes);
							const count = changes.find(
								(change) => change.resourceId === resource.id,
							)?.countAfter;
							toast.show({
								title: t("projectDetail.toast.dataUpdated"),
								description:
									count === undefined ? (
										<>
											<b className="font-mono">{resource.name}</b>.
										</>
									) : (
										toastText(
											t("projectDetail.toast.recordsFor", {
												count,
												name: resource.name,
											}),
										)
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
							title: toastText(
								t("projectDetail.toast.deleted", { name: gone.name }),
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
