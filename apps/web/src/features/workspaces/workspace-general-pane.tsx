import { workspaceRoleAllows } from "@localman/shared/access";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { DANGER_GHOST } from "../collaborators/collaborators-footer";
import { WORKSPACES_KEY, useForgetWorkspace } from "./current-workspace";
import { translatedError, workspaceErrorMessage } from "./workspace-errors";
import { WorkspaceIcon } from "./workspace-icon";
import {
	type Workspace,
	deleteWorkspace,
	updateWorkspace,
} from "./workspaces-api";

/**
 * General tab: name and description (Admins edit, others read), the type,
 * and for Admins of a team workspace "Delete workspace" with confirmation.
 */
export function WorkspaceGeneralPane({ workspace }: { workspace: Workspace }) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const navigate = useNavigate();
	const forget = useForgetWorkspace();
	const canEdit = workspaceRoleAllows(workspace.role, "editDetails");
	const canDelete =
		workspace.type === "team" &&
		workspaceRoleAllows(workspace.role, "createDeleteWorkspace");
	const [name, setName] = useState(workspace.name);
	const [description, setDescription] = useState(workspace.description ?? "");
	const [nameError, setNameError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);
	const changed =
		name.trim() !== workspace.name ||
		description.trim() !== (workspace.description ?? "");

	const save = useMutation({
		mutationFn: () => updateWorkspace(workspace.id, { name, description }),
		onSuccess: (updated) => {
			client.setQueryData<Workspace[]>(WORKSPACES_KEY, (items) =>
				items?.map((w) => (w.id === updated.id ? updated : w)),
			);
			toast.show({ tone: "success", title: t("workspaces.general.saved") });
		},
	});

	async function remove() {
		try {
			await deleteWorkspace(workspace.id);
		} catch (error) {
			throw translatedError(error, t);
		}
		toast.show({
			title: t("workspaces.general.deleted", { name: workspace.name }),
		});
		navigate("/api-client");
		await forget(workspace.id);
	}

	return (
		<div data-id="ws-settings-general" className="grid gap-6">
			<form
				noValidate
				className="grid gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					if (name.trim() === "") {
						setNameError(t("workspaces.create.nameRequired"));
						return;
					}
					save.mutate();
				}}
			>
				{canEdit ? null : (
					<Alert tone="info">{t("workspaces.general.adminOnly")}</Alert>
				)}
				<FormField
					label={t("workspaces.general.name")}
					error={nameError ?? undefined}
					required
				>
					<Input
						value={name}
						maxLength={100}
						disabled={!canEdit}
						data-id="ws-settings-name"
						onChange={(event) => {
							setName(event.target.value);
							setNameError(null);
						}}
					/>
				</FormField>
				<FormField
					label={`${t("workspaces.general.description")} ${t("common.optional")}`}
				>
					<Textarea
						value={description}
						maxLength={1000}
						rows={3}
						disabled={!canEdit}
						data-id="ws-settings-description"
						onChange={(event) => setDescription(event.target.value)}
					/>
				</FormField>
				<dl className="m-0 grid gap-1 text-sm">
					<dt className="font-mono font-semibold text-[0.8125rem]">
						{t("workspaces.general.type")}
					</dt>
					<dd className="m-0 flex items-center gap-2 text-muted">
						<WorkspaceIcon type={workspace.type} size={14} />
						{workspace.type === "personal"
							? t("workspaces.general.typePersonal")
							: t("workspaces.general.typeTeam")}
					</dd>
				</dl>
				{save.error ? (
					<Alert tone="danger">{workspaceErrorMessage(save.error, t)}</Alert>
				) : null}
				{canEdit ? (
					<Button
						type="submit"
						variant="primary"
						className="justify-self-start"
						disabled={!changed}
						loading={save.isPending}
						data-id="ws-settings-save"
					>
						{t("common.actions.save")}
					</Button>
				) : null}
			</form>
			{canDelete ? (
				<>
					<Button
						variant="ghost"
						className={cn("justify-self-start", DANGER_GHOST)}
						leadingIcon={<IconTrash size={16} aria-hidden="true" />}
						data-id="ws-settings-delete"
						onClick={() => setDeleting(true)}
					>
						{t("workspaces.general.delete")}
					</Button>
					<ConfirmModal
						open={deleting}
						onOpenChange={setDeleting}
						title={t("workspaces.general.delete")}
						question={t("workspaces.general.deleteQuestion", {
							name: workspace.name,
						})}
						confirmLabel={t("workspaces.general.delete")}
						onConfirm={remove}
						data-id="ws-settings-delete-confirm"
					>
						<p className="m-0">{t("workspaces.general.deleteText")}</p>
					</ConfirmModal>
				</>
			) : null}
		</div>
	);
}
