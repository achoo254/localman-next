import { useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useT } from "../../i18n/i18n-context";
import { ApiError } from "../../lib/api-client";
import type { Project } from "../../pages/projects/projects-api";
import {
	type McpTokenChange,
	type McpTokenStatus,
	mcpTokenQueryKey,
	rotateMcpToken,
	setMcpTokenRequired,
} from "./mcp-token-api";

export type McpTokenDialog = "enable" | "disable" | "rotate";

export interface McpTokenDialogsProps {
	project: Project;
	status: McpTokenStatus;
	dialog: McpTokenDialog | null;
	onClose: () => void;
	/** Runs before the modal closes, so the result is on screen for focus. */
	onChanged: (dialog: McpTokenDialog, change: McpTokenChange) => void;
	onCloseAutoFocus: (event: Event) => void;
}

const DATA_IDS: Record<McpTokenDialog, string> = {
	enable: "modal-mcp-token-enable",
	disable: "modal-mcp-token-disable",
	rotate: "modal-mcp-rotate",
};

function requestFor(
	dialog: McpTokenDialog,
	projectId: string,
): Promise<McpTokenChange> {
	if (dialog === "rotate") return rotateMcpToken(projectId);
	return setMcpTokenRequired(projectId, dialog === "enable");
}

/**
 * Confirmations of the token setting: turn on, turn off, rotate. Errors
 * stay in the modal and nothing changes; a 403 (no longer the owner)
 * also refetches the project so the setting disappears.
 */
export function McpTokenDialogs({
	project,
	status,
	dialog,
	onClose,
	onChanged,
	onCloseAutoFocus,
}: McpTokenDialogsProps) {
	const queryClient = useQueryClient();
	const t = useT();
	if (!dialog) return null;

	async function confirm(kind: McpTokenDialog) {
		try {
			onChanged(kind, await requestFor(kind, project.id));
		} catch (error) {
			if (error instanceof ApiError && error.status === 403) {
				void queryClient.invalidateQueries({
					queryKey: ["project", project.id],
				});
				void queryClient.invalidateQueries({
					queryKey: mcpTokenQueryKey(project.id),
				});
			}
			throw error;
		}
	}

	return (
		<ConfirmModal
			open
			onOpenChange={(open) => !open && onClose()}
			title={t(`mcp.dialogs.${dialog}.title`)}
			question={
				dialog === "disable"
					? t("mcp.dialogs.disable.question")
					: t(`mcp.dialogs.${dialog}.question`, { project: project.name })
			}
			confirmLabel={t(`mcp.dialogs.${dialog}.confirm`)}
			onConfirm={() => confirm(dialog)}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id={DATA_IDS[dialog]}
		>
			<p className="m-0">{t(`mcp.dialogs.${dialog}.body`)}</p>
			{dialog === "enable" ? (
				<p className="m-0">
					{status.token
						? t("mcp.dialogs.enable.bodyKept", { last4: status.token.last4 })
						: t("mcp.dialogs.enable.bodyNew")}
				</p>
			) : null}
		</ConfirmModal>
	);
}
