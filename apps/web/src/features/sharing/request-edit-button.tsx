import type { ShareableElementType } from "@localman/shared/access";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { MAX_REQUEST_MESSAGE } from "./request-access-form";
import { requestElementAccess } from "./sharing-api";
import { errorCodeOf, sharingErrorMessage } from "./sharing-errors";

export interface RequestEditButtonProps {
	elementType: ShareableElementType;
	elementId: string;
	elementName: string;
	"data-id": string;
}

/**
 * "Request to Edit" for a Viewer: asks the element's Editors for the
 * Editor role, with an optional message. They get it as a notification.
 */
export function RequestEditButton(props: RequestEditButtonProps) {
	const t = useT();
	const toast = useToast();
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const send = useMutation({
		mutationFn: () =>
			requestElementAccess(
				props.elementType,
				props.elementId,
				"editor",
				message,
			),
		onSuccess: () => {
			setOpen(false);
			setMessage("");
			toast.show({ tone: "success", title: t("sharing.requestEdit.sent") });
		},
		onError: (error) => {
			if (errorCodeOf(error) !== "ALREADY_HAS_ACCESS") return;
			setOpen(false);
			toast.show({ tone: "info", title: t("sharing.requestEdit.already") });
		},
	});
	const failed =
		send.isError && errorCodeOf(send.error) !== "ALREADY_HAS_ACCESS";
	return (
		<Modal
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) send.reset();
			}}
			trigger={
				<Button size="sm" variant="secondary" data-id={props["data-id"]}>
					{t("sharing.requestEdit.button")}
				</Button>
			}
			title={t("sharing.requestEdit.title")}
			description={t("sharing.requestEdit.description", {
				name: props.elementName,
			})}
			size="sm"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						variant="primary"
						data-id={`${props["data-id"]}-send`}
						loading={send.isPending}
						onClick={() => send.mutate()}
					>
						{t("sharing.requestEdit.send")}
					</Button>
				</ModalFooter>
			}
		>
			<FormField
				label={t("sharing.requestEdit.message")}
				error={failed ? sharingErrorMessage(send.error, t) : undefined}
				announceError
			>
				<Textarea
					value={message}
					maxLength={MAX_REQUEST_MESSAGE}
					rows={3}
					data-id={`${props["data-id"]}-message`}
					onChange={(event) => setMessage(event.target.value)}
				/>
			</FormField>
		</Modal>
	);
}
