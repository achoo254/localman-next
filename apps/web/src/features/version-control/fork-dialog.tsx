import { FORK_LABEL_MAX } from "@localman/shared/api-client";
import { useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Select } from "../../components/ui/select";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useCurrentUser } from "../auth/use-current-user";
import { useWorkspaces } from "../workspaces/current-workspace";
import { useForkErrorMessage } from "./fork-errors";
import type { ForkTarget } from "./forks-api";
import { useForkActions } from "./use-forks";

export interface ForkDialogProps {
	target: ForkTarget;
	name: string;
	/** The caller's role on it: a Viewer forks into their personal workspace only. */
	role: "editor" | "viewer";
	onClose: () => void;
	/** Opens the new fork. */
	onForked: (forkId: string) => void;
}

/** Label and workspace of a new fork. */
export function ForkDialog(props: ForkDialogProps) {
	const t = useT();
	const toast = useToast();
	const formId = useId();
	const errorText = useForkErrorMessage();
	const session = useCurrentUser();
	const username =
		session.status === "authenticated" ? session.user.username : "my";
	const { create } = useForkActions(props.target);
	const workspaces = (useWorkspaces().data ?? []).filter(
		(workspace) =>
			workspace.role !== "viewer" &&
			(props.role === "editor" || workspace.type === "personal"),
	);
	const [label, setLabel] = useState(
		`${username}-fork`.slice(0, FORK_LABEL_MAX),
	);
	const [workspaceId, setWorkspaceId] = useState<string | null>(null);
	const chosen = workspaceId ?? workspaces[0]?.id ?? "";
	const kind = t(`versionControl.kinds.${props.target.kind}`);
	const submit = () =>
		create.mutate(
			{ label: label.trim(), workspaceId: chosen },
			{
				onSuccess: (forkId) => {
					toast.show({
						tone: "success",
						title: t("versionControl.fork.done", { name: props.name }),
					});
					props.onClose();
					props.onForked(forkId);
				},
			},
		);
	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) props.onClose();
			}}
			title={t("versionControl.fork.title", { name: props.name })}
			description={t("versionControl.fork.intro", { kind })}
			size="md"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						type="submit"
						form={formId}
						data-id="modal-fork-submit"
						loading={create.isPending}
						disabled={label.trim() === "" || chosen === ""}
					>
						{t("versionControl.fork.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<form
				id={formId}
				data-id="modal-fork"
				className="grid gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<FormField
					label={t("versionControl.fork.label")}
					hint={t("versionControl.fork.labelHint")}
				>
					<Input
						value={label}
						maxLength={FORK_LABEL_MAX}
						data-id="modal-fork-label"
						onChange={(event) => setLabel(event.target.value)}
					/>
				</FormField>
				<FormField
					label={t("versionControl.fork.workspace")}
					hint={
						props.role === "viewer"
							? t("versionControl.fork.personalOnly", { kind })
							: undefined
					}
				>
					<Select
						value={chosen}
						data-id="modal-fork-workspace"
						onChange={(event) => setWorkspaceId(event.target.value)}
					>
						{workspaces.map((workspace) => (
							<option key={workspace.id} value={workspace.id}>
								{workspace.name}
							</option>
						))}
					</Select>
				</FormField>
				{workspaces.length === 0 ? (
					<Alert tone="warning">{t("versionControl.fork.noWorkspace")}</Alert>
				) : null}
				{create.isError ? (
					<Alert tone="danger">{errorText(create.error)}</Alert>
				) : null}
			</form>
		</Modal>
	);
}
