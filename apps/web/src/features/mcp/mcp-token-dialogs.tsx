import { useQueryClient } from "@tanstack/react-query";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { ApiError } from "../../lib/api-client";
import type { Project } from "../../pages/projects/projects-api";
import { MCP_TOKEN_DIALOG_COPY } from "./mcp-copy";
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
	if (!dialog) return null;
	const copy = MCP_TOKEN_DIALOG_COPY[dialog];

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
			title={copy.title}
			question={copy.question(project.name)}
			confirmLabel={copy.confirm}
			onConfirm={() => confirm(dialog)}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id={DATA_IDS[dialog]}
		>
			<p className="m-0">{copy.body}</p>
			{dialog === "enable" ? (
				<p className="m-0">
					{status.token
						? MCP_TOKEN_DIALOG_COPY.enable.bodyKept(status.token.last4)
						: MCP_TOKEN_DIALOG_COPY.enable.bodyNew}
				</p>
			) : null}
		</ConfirmModal>
	);
}
