import { useRef } from "react";
import { Button } from "../../../components/ui/button";
import { Modal, ModalClose } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { useT } from "../../../i18n/i18n-context";

export interface CloseTabModalProps {
	/** Label of the tab about to close; `null` keeps the modal closed. */
	tabName: string | null;
	onCancel: () => void;
	onDiscard: () => void;
	/** Where focus goes once the tab is gone. */
	onCloseAutoFocus?: (event: Event) => void;
}

/** Asks before closing a tab whose edits exist nowhere else. */
export function CloseTabModal({
	tabName,
	onCancel,
	onDiscard,
	onCloseAutoFocus,
}: CloseTabModalProps) {
	const t = useT();
	const cancel = useRef<HTMLButtonElement>(null);
	return (
		<Modal
			open={tabName !== null}
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
			title={t("apiClient.tabs.unsavedTitle")}
			size="sm"
			initialFocusRef={cancel}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-unsaved"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button ref={cancel} variant="ghost" data-id="modal-unsaved-cancel">
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						variant="danger"
						data-id="modal-unsaved-discard"
						onClick={onDiscard}
					>
						{t("apiClient.tabs.discard")}
					</Button>
				</ModalFooter>
			}
		>
			<p className="text-sm">
				{t("apiClient.tabs.unsavedBody", { name: tabName ?? "" })}
			</p>
		</Modal>
	);
}
