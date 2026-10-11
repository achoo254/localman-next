import { workspaceRoleAllows } from "@localman/shared/access";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Select } from "../../components/ui/select";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useWorkspaces } from "../workspaces/current-workspace";
import { collectionErrorMessage } from "./collection-errors";
import type { TrashedCollection } from "./collection-parsers";
import { useRestoreTrashed } from "./use-trash";

export interface RestoreModalProps {
	item: TrashedCollection;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCloseAutoFocus?: (event: Event) => void;
}

/** Restores a deleted collection into a workspace the caller can add to. */
export function RestoreModal({
	item,
	open,
	onOpenChange,
	onCloseAutoFocus,
}: RestoreModalProps) {
	const t = useT();
	const toast = useToast();
	const restore = useRestoreTrashed();
	const allowed = (useWorkspaces().data ?? []).filter((w) =>
		workspaceRoleAllows(w.role, "addElements"),
	);
	// Its own workspace first when the caller may still add there.
	const [choice, setChoice] = useState<string | null>(null);
	const target =
		allowed.find((w) => w.id === choice) ??
		allowed.find((w) => w.id === item.workspaceId) ??
		allowed[0] ??
		null;

	const submit = (): void => {
		if (!target) return;
		restore.mutate(
			{ id: item.id, workspaceId: target.id },
			{
				onSuccess: () => {
					toast.show({
						tone: "success",
						title: t("collections.trash.toast.restored", {
							name: item.name,
							workspace: target.name,
						}),
					});
					onOpenChange(false);
				},
			},
		);
	};

	return (
		<Modal
			open={open}
			onOpenChange={(next) => {
				if (!restore.isPending) onOpenChange(next);
			}}
			title={t("collections.trash.restoreModal.title", { name: item.name })}
			size="sm"
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-restore"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={restore.isPending}>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						variant="primary"
						data-id="modal-restore-submit"
						disabled={!target}
						loading={restore.isPending}
						onClick={submit}
					>
						{t("collections.trash.restoreModal.submit")}
					</Button>
				</ModalFooter>
			}
		>
			{allowed.length === 0 ? (
				<Alert tone="info">
					{t("collections.trash.restoreModal.noWorkspace")}
				</Alert>
			) : (
				<FormField label={t("collections.trash.restoreModal.workspace")}>
					<Select
						value={target?.id ?? ""}
						data-id="modal-restore-workspace"
						onChange={(event) => setChoice(event.target.value)}
					>
						{allowed.map((workspace) => (
							<option key={workspace.id} value={workspace.id}>
								{workspace.name}
							</option>
						))}
					</Select>
				</FormField>
			)}
			{restore.isError ? (
				<Alert tone="danger">{collectionErrorMessage(restore.error, t)}</Alert>
			) : null}
		</Modal>
	);
}
