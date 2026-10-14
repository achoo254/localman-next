import type {
	WorkspaceSharingSettings,
	WorkspaceSharingSwitch,
} from "@localman/shared/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import {
	publicSharingErrorMessage,
	withTranslatedError,
} from "./public-sharing-errors";
import { workspaceSharingKey } from "./use-public-sharing";
import { updateWorkspaceSharing } from "./workspace-sharing-api";

/**
 * Turning a workspace switch off: a dry run counts what stops at once,
 * the Admin confirms, then the switch goes off. The confirm button stays
 * off until the counts are known.
 */
export function WorkspaceSharingOffModal({
	workspaceId,
	name,
	onClose,
}: {
	workspaceId: string;
	/** The switch being turned off; null keeps the modal closed. */
	name: WorkspaceSharingSwitch | null;
	onClose: () => void;
}) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	// Keeps the text while the modal fades out after `name` went null.
	const [shown, setShown] = useState(name);
	useEffect(() => {
		if (name) setShown(name);
	}, [name]);
	const dryRun = useQuery({
		queryKey: [...workspaceSharingKey(workspaceId), "off", name],
		queryFn: () => {
			if (!name) throw new Error("No switch to turn off");
			return updateWorkspaceSharing(workspaceId, { [name]: false }, true);
		},
		enabled: name !== null,
		staleTime: 0,
		gcTime: 0,
	});
	const label = shown
		? t(`publicSharing.view.workspace.switches.${shown}`)
		: "";

	async function turnOff() {
		if (!name) return;
		const result = await withTranslatedError(t, () =>
			updateWorkspaceSharing(workspaceId, { [name]: false }, false),
		);
		client.setQueryData<WorkspaceSharingSettings>(
			workspaceSharingKey(workspaceId),
			result.sharing,
		);
		toast.show({
			tone: "success",
			title: t("publicSharing.view.workspace.saved"),
		});
	}

	const stopped = dryRun.data?.stopped;
	return (
		<ConfirmModal
			open={name !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("publicSharing.view.workspace.offTitle", { name: label })}
			question={t("publicSharing.view.workspace.offQuestion", { name: label })}
			confirmLabel={t("publicSharing.view.workspace.offConfirm")}
			confirmDisabled={!stopped}
			onConfirm={turnOff}
			data-id="ws-sharing-off"
		>
			<span>{t("publicSharing.view.workspace.offStops")}</span>
			{stopped ? (
				<ul className="m-0 grid gap-0.5 pl-5" data-id="ws-sharing-off-counts">
					<li>
						{t("publicSharing.view.workspace.stopped.links", {
							count: stopped.links,
						})}
					</li>
					<li>
						{t("publicSharing.view.workspace.stopped.accessKeys", {
							count: stopped.accessKeys,
						})}
					</li>
					<li>
						{t("publicSharing.view.workspace.stopped.runButtons", {
							count: stopped.runButtons,
						})}
					</li>
				</ul>
			) : dryRun.error ? (
				<Alert tone="danger">
					{publicSharingErrorMessage(dryRun.error, t)}
				</Alert>
			) : (
				<output>{t("publicSharing.view.workspace.offCountsLoading")}</output>
			)}
		</ConfirmModal>
	);
}
