import { workspaceRoleAllows } from "@localman/shared/access";
import type { CollectionSummary } from "@localman/shared/api-client";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import { useWorkspaces } from "../workspaces/current-workspace";
import { WorkspaceIcon } from "../workspaces/workspace-icon";
import type { Workspace } from "../workspaces/workspaces-api";
import { collectionErrorMessage } from "./collection-errors";
import { useMoveCollection } from "./use-collection-mutations";

export interface MoveCollectionModalProps {
	summary: CollectionSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCloseAutoFocus?: (event: Event) => void;
}

/** Why a workspace cannot take the collection, or `null` when it can. */
function blockedReason(
	target: Workspace,
	from: Workspace | undefined,
	t: Translate,
): string | null {
	if (target.id === from?.id) return t("collections.move.current");
	if (from?.type === "team" && target.type === "personal") {
		return t("collections.move.teamToPersonal");
	}
	if (!workspaceRoleAllows(target.role, "addElements")) {
		return t("collections.move.noAccess");
	}
	return null;
}

/** Moves a collection to another of the caller's workspaces. */
export function MoveCollectionModal({
	summary,
	open,
	onOpenChange,
	onCloseAutoFocus,
}: MoveCollectionModalProps) {
	const t = useT();
	const toast = useToast();
	const workspaces = useWorkspaces().data ?? [];
	const move = useMoveCollection();
	const [choice, setChoice] = useState<string | null>(null);
	const from = workspaces.find((w) => w.id === summary.workspaceId);
	const target = workspaces.find((w) => w.id === choice) ?? null;

	const submit = (): void => {
		if (!target) return;
		move.mutate(
			{ summary, workspaceId: target.id },
			{
				onSuccess: () => {
					toast.show({
						tone: "success",
						title: t("collections.toast.moved", {
							name: summary.name,
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
				if (!move.isPending) onOpenChange(next);
			}}
			title={t("collections.move.title", { name: summary.name })}
			description={t("collections.move.intro")}
			size="md"
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-move"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={move.isPending}>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						variant="primary"
						data-id="modal-move-submit"
						disabled={!target}
						loading={move.isPending}
						onClick={submit}
					>
						{t("collections.move.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
				<legend className="mb-2 font-mono font-semibold text-[0.8125rem]">
					{t("collections.move.legend")}
				</legend>
				{workspaces.map((workspace) => {
					const blocked = blockedReason(workspace, from, t);
					const note =
						blocked ??
						t(
							workspace.type === "team"
								? "collections.move.team"
								: "collections.move.personal",
						);
					return (
						<label
							key={workspace.id}
							className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 has-checked:border-primary has-disabled:cursor-not-allowed has-disabled:opacity-60"
						>
							<input
								type="radio"
								name="move-workspace"
								value={workspace.id}
								checked={choice === workspace.id}
								disabled={blocked !== null}
								className="size-4 accent-primary"
								data-id={`modal-move-ws-${workspace.id}`}
								onChange={() => setChoice(workspace.id)}
							/>
							<WorkspaceIcon type={workspace.type} size={16} />
							<span className="grid min-w-0">
								<span className="truncate font-mono font-semibold text-sm">
									{workspace.name}
								</span>
								<span className="text-muted text-xs">{note}</span>
							</span>
						</label>
					);
				})}
			</fieldset>
			{move.isError ? (
				<Alert tone="danger">{collectionErrorMessage(move.error, t)}</Alert>
			) : null}
		</Modal>
	);
}
