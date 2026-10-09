import { IconSend } from "@tabler/icons-react";
import { Suspense, lazy, useId, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { SuccessPanel } from "../../components/ui/success-panel";
import { useCurrentUser } from "../auth/use-current-user";
import type { ProInterestSource } from "./pro-interest-options";

// The form validates with the shared zod schema; load it (and zod) only
// when someone opens the modal, not with the landing or the header.
const ProInterestForm = lazy(async () => ({
	default: (await import("./pro-interest-form")).ProInterestForm,
}));

const LOADING = (
	<output className="block font-mono text-muted text-sm">Đang tải…</output>
);

export interface ProInterestModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	source: ProInterestSource;
}

/** "Liên hệ về gói Pro": the interest form, then a confirmation. */
export function ProInterestModal({
	open,
	onOpenChange,
	source,
}: ProInterestModalProps) {
	const session = useCurrentUser();
	const formId = useId();
	const [busy, setBusy] = useState(false);
	const firstField = useRef<HTMLInputElement>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const user = session.status === "authenticated" ? session.user : null;

	function changeOpen(next: boolean) {
		if (!next) setSentTo(null);
		onOpenChange(next);
	}

	const footer = sentTo ? (
		<ModalFooter>
			<ModalClose asChild>
				<Button variant="primary" data-id="pro-interest-close" autoFocus>
					Đóng
				</Button>
			</ModalClose>
		</ModalFooter>
	) : (
		<ModalFooter>
			<ModalClose asChild>
				<Button variant="ghost" data-id="pro-interest-cancel">
					Huỷ
				</Button>
			</ModalClose>
			<Button
				type="submit"
				form={formId}
				variant="primary"
				disabled={busy}
				data-id="pro-interest-submit"
				leadingIcon={<IconSend size={16} aria-hidden="true" />}
			>
				{busy ? "Đang gửi…" : "Gửi đăng ký"}
			</Button>
		</ModalFooter>
	);

	return (
		<Modal
			open={open}
			onOpenChange={changeOpen}
			title="Liên hệ về gói Pro"
			size="md"
			initialFocusRef={firstField}
			data-id="modal-pro-interest"
			footer={footer}
		>
			{sentTo ? (
				<output className="block">
					<SuccessPanel title="Đã ghi nhận" data-id="pro-interest-success">
						Chúng tôi sẽ liên hệ qua email bạn để lại: <b>{sentTo}</b>.
					</SuccessPanel>
				</output>
			) : session.status === "loading" ? (
				LOADING
			) : (
				<Suspense fallback={LOADING}>
					<ProInterestForm
						key={user?.sub ?? "visitor"}
						formId={formId}
						firstFieldRef={firstField}
						source={source}
						signedIn={user !== null}
						accountEmail={user?.email ?? null}
						onBusyChange={setBusy}
						onSubmitted={setSentTo}
					/>
				</Suspense>
			)}
		</Modal>
	);
}
