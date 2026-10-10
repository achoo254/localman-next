import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { deleteInbox, inboxesKey } from "./inbox-api";

export interface DeleteInboxModalProps {
	projectId: string;
	name: string;
	onClose: () => void;
	/** Where focus lands once the inbox (and its trash button) is gone. */
	focusAfterDelete: () => void;
}

/** "Delete inbox x?": the URL stops at once, logged requests stay. */
export function DeleteInboxModal({
	projectId,
	name,
	onClose,
	focusAfterDelete,
}: DeleteInboxModalProps) {
	const t = useT();
	const toast = useToast();
	const queryClient = useQueryClient();
	const deleted = useRef(false);
	return (
		<ConfirmModal
			open
			onOpenChange={(open) => !open && onClose()}
			title={t("webhookInbox.remove.title")}
			question={renderRich(t("webhookInbox.remove.question", { name }))}
			confirmLabel={t("webhookInbox.remove.confirm")}
			data-id="modal-delete-inbox"
			onCloseAutoFocus={(event) => {
				if (!deleted.current) return;
				event.preventDefault();
				focusAfterDelete();
			}}
			onConfirm={async () => {
				await deleteInbox(projectId, name);
				deleted.current = true;
				await queryClient.invalidateQueries({
					queryKey: inboxesKey(projectId),
				});
				toast.show({
					tone: "success",
					title: renderRich(t("webhookInbox.remove.done", { name })),
				});
			}}
		>
			<span>{t("webhookInbox.remove.body")}</span>
		</ConfirmModal>
	);
}
