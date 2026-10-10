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
import { importedToast } from "./imported-toast";
import { SummarizedChangesConfirmModal } from "./summarized-changes-confirm-modal";
import { toastText } from "./toast-text";

/*
 * The resource and data modals carry CodeMirror and the Faker catalog;
 * they load on first open so the page itself stays light.
 */
const ResourceFormModal = lazy(async () => ({
	default: (await import("../../features/resources/resource-form-modal"))
		.ResourceFormModal,
}));
const ImportResourceDialog = lazy(async () => ({
	default: (await import("../../features/resources/import-resource-dialog"))
		.ImportResourceDialog,
}));
const ResourceDataModal = lazy(async () => ({
	default: (await import("../../features/resources/resource-data-modal"))
		.ResourceDataModal,
}));

/** `summarize`: a project-wide write, its lines folded under a total. */
export type ProjectConfirm = DataConfirm & { summarize?: boolean };

export type ProjectDialog =
	| { kind: "none" }
	| { kind: "form"; resource: Resource | null }
	| { kind: "import" }
	| { kind: "data"; resource: Resource }
	| { kind: "delete"; resource: Resource }
	| { kind: "confirm"; confirm: ProjectConfirm };

export const NO_DIALOG: ProjectDialog = { kind: "none" };

export interface ProjectDetailDialogsProps {
	projectId: string;
	dialog: ProjectDialog;
	resources: readonly Resource[];
	onClose: () => void;
	/** The owner's plan has no room for another resource. */
	onPlanLimit: () => void;
	/** Owners may open the plans from the import's "no room" warning. */
	isOwner: boolean;
}

const importButton = () =>
	document.querySelector<HTMLElement>(
		'[data-id="project-detail-import-resource"]',
	);

export function ProjectDetailDialogs({
	projectId,
	dialog,
	resources,
	onClose,
	onPlanLimit,
	isOwner,
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
		case "import":
			return (
				<Suspense fallback={null}>
					<ImportResourceDialog
						projectId={projectId}
						resources={resources}
						onManagePlan={isOwner ? onPlanLimit : null}
						onOpenChange={closeOnFalse}
						onPlanLimit={onPlanLimit}
						fallbackFocus={importButton}
						onImported={(result) => {
							onClose();
							void cache.invalidate();
							toast.show(importedToast(result, t));
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
			return dialog.confirm.summarize ? (
				<SummarizedChangesConfirmModal
					confirm={dialog.confirm}
					onOpenChange={closeOnFalse}
				/>
			) : (
				<DataChangesConfirmModal
					confirm={dialog.confirm}
					onOpenChange={closeOnFalse}
				/>
			);
		default:
			return null;
	}
}
