import { useRef } from "react";
import { Button } from "../../../components/ui/button";
import { Modal, ModalClose } from "../../../components/ui/modal";
import { ModalFooter } from "../../../components/ui/modal-footer";
import { useT } from "../../../i18n/i18n-context";

/** What the modal says. */
export interface CloseTabPrompt {
	title: string;
	body: string;
}

export interface CloseTabModalProps {
	open: boolean;
	/** Kept while the modal fades out, so its text does not blank. */
	prompt: CloseTabPrompt | null;
	onCancel: () => void;
	onDiscard: () => void;
	/** Where focus goes once the tab is gone. */
	onCloseAutoFocus?: (event: Event) => void;
}

/** Asks before closing tabs whose edits exist nowhere else. */
export function CloseTabModal({
	open,
	prompt,
	onCancel,
	onDiscard,
	onCloseAutoFocus,
}: CloseTabModalProps) {
	const t = useT();
	const cancel = useRef<HTMLButtonElement>(null);
	return (
		<Modal
			open={open}
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
			title={prompt?.title ?? ""}
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
			<p className="text-sm">{prompt?.body}</p>
		</Modal>
	);
}
