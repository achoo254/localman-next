import type { ContactSource } from "@localman/shared/constants";
import { IconSend } from "@tabler/icons-react";
import { type RefObject, useId, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { SuccessPanel } from "../../components/ui/success-panel";
import { reloadCurrentUser, useCurrentUser } from "../auth/use-current-user";
import { type FeedbackAccount, FeedbackFormBody } from "./feedback-form-body";

export interface FeedbackFormProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** App area the form was opened from (see `feedbackSourceFor`). */
	source: ContactSource;
}

interface FeedbackContentProps {
	formId: string;
	firstFieldRef: RefObject<HTMLTextAreaElement | null>;
	source: ContactSource;
	onBusyChange: (busy: boolean) => void;
	onSubmitted: (contact: string | null) => void;
}

/**
 * Reads the session only once the modal is open, so a closed footer form
 * adds no request to the page. When the API treats a signed-in sender as
 * a visitor (session expired), the session is read again: the form keeps
 * what was typed and shows Turnstile.
 */
function FeedbackContent(props: FeedbackContentProps) {
	const session = useCurrentUser();
	// Once the form shows, a session re-read (expired session) keeps it
	// mounted with the last known account, so nothing typed is lost.
	const account = useRef<FeedbackAccount | null | undefined>(undefined);
	if (session.status !== "loading") {
		account.current = session.status === "authenticated" ? session.user : null;
	}
	if (account.current === undefined) {
		return (
			<output className="block font-mono text-muted text-sm">Đang tải…</output>
		);
	}
	return (
		<FeedbackFormBody
			{...props}
			account={account.current}
			onSessionLost={() => void reloadCurrentUser()}
		/>
	);
}

/**
 * "Góp ý / Liên hệ": the in-app form that replaces a contact email. The
 * result region stays mounted so screen readers announce the confirmation
 * when it replaces the form.
 */
export function FeedbackForm({
	open,
	onOpenChange,
	source,
}: FeedbackFormProps) {
	const formId = useId();
	const [busy, setBusy] = useState(false);
	/** Set once sent: the reply address left by the sender, if any. */
	const [sent, setSent] = useState<{ contact: string | null } | null>(null);
	const firstField = useRef<HTMLTextAreaElement>(null);

	function changeOpen(next: boolean) {
		if (!next) setSent(null);
		onOpenChange(next);
	}

	const footer = sent ? (
		<ModalFooter>
			<ModalClose asChild>
				<Button variant="primary" data-id="modal-feedback-close" autoFocus>
					Đóng
				</Button>
			</ModalClose>
		</ModalFooter>
	) : (
		<ModalFooter>
			<ModalClose asChild>
				<Button variant="ghost" data-id="modal-feedback-cancel">
					Huỷ
				</Button>
			</ModalClose>
			<Button
				type="submit"
				form={formId}
				variant="primary"
				disabled={busy}
				data-id="modal-feedback-submit"
				leadingIcon={<IconSend size={16} aria-hidden="true" />}
			>
				{busy ? "Đang gửi…" : "Gửi"}
			</Button>
		</ModalFooter>
	);

	return (
		<Modal
			open={open}
			onOpenChange={changeOpen}
			title="Góp ý / Liên hệ"
			size="md"
			initialFocusRef={firstField}
			data-id="modal-feedback"
			footer={footer}
		>
			{sent ? null : (
				<FeedbackContent
					formId={formId}
					firstFieldRef={firstField}
					source={source}
					onBusyChange={setBusy}
					onSubmitted={(contact) => setSent({ contact })}
				/>
			)}
			<div
				aria-live="polite"
				aria-atomic="true"
				data-id="modal-feedback-result"
			>
				{sent ? (
					<SuccessPanel title="Đã gửi, cảm ơn bạn">
						Chúng tôi đã nhận được tin của bạn.
						{sent.contact
							? ` Chúng tôi sẽ trả lời qua ${sent.contact} nếu cần.`
							: null}
					</SuccessPanel>
				) : null}
			</div>
		</Modal>
	);
}
