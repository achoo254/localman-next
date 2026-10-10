import { IconLogout } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useForgetWorkspace } from "./current-workspace";
import { translatedError } from "./workspace-errors";
import { leaveWorkspace } from "./workspace-members-api";
import type { Workspace } from "./workspaces-api";

/**
 * "Leave workspace" with confirmation. The last Admin is refused
 * (`LAST_ADMIN`) and the reason stays in the dialog; on success the
 * personal workspace becomes current and the workbench opens.
 */
export function WorkspaceLeaveButton({ workspace }: { workspace: Workspace }) {
	const t = useT();
	const toast = useToast();
	const navigate = useNavigate();
	const forget = useForgetWorkspace();
	const [open, setOpen] = useState(false);

	async function leave() {
		try {
			await leaveWorkspace(workspace.id);
		} catch (error) {
			throw translatedError(error, t);
		}
		toast.show({
			title: t("workspaces.members.left", { workspace: workspace.name }),
		});
		navigate("/api-client");
		await forget(workspace.id);
	}

	return (
		<>
			<Button
				variant="ghost"
				data-id="ws-settings-leave"
				className="justify-self-start"
				leadingIcon={<IconLogout size={16} aria-hidden="true" />}
				onClick={() => setOpen(true)}
			>
				{t("workspaces.members.leave")}
			</Button>
			<ConfirmModal
				open={open}
				onOpenChange={setOpen}
				title={t("workspaces.members.leave")}
				question={t("workspaces.members.leaveQuestion", {
					workspace: workspace.name,
				})}
				confirmLabel={t("workspaces.members.leave")}
				onConfirm={leave}
				data-id="ws-settings-leave-confirm"
			>
				<p className="m-0">{t("workspaces.members.leaveText")}</p>
			</ConfirmModal>
		</>
	);
}
