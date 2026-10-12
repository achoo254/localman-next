import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { WORKSPACES_KEY, useSelectWorkspace } from "./current-workspace";
import { planLimitOf, workspaceErrorMessage } from "./workspace-errors";
import { type Workspace, createWorkspace } from "./workspaces-api";

const FORM_ID = "create-workspace-form";

export interface CreateWorkspaceModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Runs after the new workspace became the current one. */
	onCreated?: (workspace: Workspace) => void;
}

/**
 * Name and description of a new team workspace. It becomes the current
 * workspace; past the plan's team workspace limit, the "Requires Pro" card
 * explains why and links to the plans.
 */
export function CreateWorkspaceModal({
	open,
	onOpenChange,
	onCreated,
}: CreateWorkspaceModalProps) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const select = useSelectWorkspace();
	const nameInput = useRef<HTMLInputElement>(null);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [nameError, setNameError] = useState<string | null>(null);
	const create = useMutation({
		mutationFn: createWorkspace,
		onSuccess: async (workspace) => {
			client.setQueryData<Workspace[]>(WORKSPACES_KEY, (items) =>
				items ? [...items, workspace] : items,
			);
			select(workspace.id);
			void client.invalidateQueries({ queryKey: WORKSPACES_KEY });
			toast.show({
				tone: "success",
				title: t("workspaces.create.created", { name: workspace.name }),
			});
			changeOpen(false);
			onCreated?.(workspace);
		},
	});
	const limited = planLimitOf(create.error) === "teamWorkspaces";

	function changeOpen(next: boolean) {
		if (!next) {
			setName("");
			setDescription("");
			setNameError(null);
			create.reset();
		}
		onOpenChange(next);
	}

	function submit() {
		if (name.trim() === "") {
			setNameError(t("workspaces.create.nameRequired"));
			nameInput.current?.focus();
			return;
		}
		create.mutate({ name, description });
	}

	return (
		<Modal
			open={open}
			onOpenChange={changeOpen}
			title={t("workspaces.create.title")}
			description={t("workspaces.create.intro")}
			initialFocusRef={nameInput}
			data-id="modal-create-workspace"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						type="submit"
						form={FORM_ID}
						variant="primary"
						loading={create.isPending}
						disabled={limited}
						data-id="modal-create-workspace-submit"
					>
						{t("workspaces.create.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<form
				id={FORM_ID}
				noValidate
				className="grid gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<FormField
					label={t("workspaces.create.name")}
					error={nameError ?? undefined}
					required
				>
					<Input
						ref={nameInput}
						value={name}
						maxLength={100}
						autoComplete="off"
						placeholder={t("workspaces.create.namePlaceholder")}
						data-id="modal-create-workspace-name"
						onChange={(event) => {
							setName(event.target.value);
							setNameError(null);
						}}
					/>
				</FormField>
				<FormField
					label={`${t("workspaces.create.description")} ${t("common.optional")}`}
				>
					<Textarea
						value={description}
						maxLength={1000}
						rows={3}
						data-id="modal-create-workspace-desc"
						onChange={(event) => setDescription(event.target.value)}
					/>
				</FormField>
			</form>
			{limited ? (
				<Alert
					tone="info"
					data-id="modal-create-workspace-limit"
					title={t("limits.reached.teamWorkspaces")}
				>
					{t("limits.feedback")}
				</Alert>
			) : create.error ? (
				<Alert tone="danger" data-id="modal-create-workspace-error">
					{workspaceErrorMessage(create.error, t)}
				</Alert>
			) : null}
		</Modal>
	);
}
