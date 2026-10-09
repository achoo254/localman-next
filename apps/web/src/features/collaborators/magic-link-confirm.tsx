import { useRef } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useT } from "../../i18n/i18n-context";

export type MagicLinkConfirm = "regenerate" | "revoke";

/** Texts and `data-id` of each confirmation. */
const COPY = {
	revoke: {
		title: "collaborators.magic.revokeTitle",
		question: "collaborators.magic.revokeQuestion",
		action: "collaborators.magic.revoke",
		body: "collaborators.magic.revokeBody",
		dataId: "modal-revoke-magic-link",
	},
	regenerate: {
		title: "collaborators.magic.regenerate",
		question: "collaborators.magic.regenerateQuestion",
		action: "collaborators.magic.regenerate",
		body: "collaborators.magic.regenerateBody",
		dataId: "modal-regenerate-magic-link",
	},
} as const;

export interface MagicLinkConfirmModalProps {
	/** null: closed. */
	confirm: MagicLinkConfirm | null;
	onClose: () => void;
	onConfirm: (confirm: MagicLinkConfirm) => Promise<void>;
	onCloseAutoFocus: (event: Event) => void;
}

/**
 * "Revoke the magic link?" or "Create a new magic link?". Keeps showing
 * the last confirmation's text while it animates out.
 */
export function MagicLinkConfirmModal({
	confirm,
	onClose,
	onConfirm,
	onCloseAutoFocus,
}: MagicLinkConfirmModalProps) {
	const t = useT();
	const last = useRef<MagicLinkConfirm | null>(null);
	if (confirm) last.current = confirm;
	const copy = COPY[confirm ?? last.current ?? "regenerate"];
	return (
		<ConfirmModal
			open={confirm !== null}
			onOpenChange={(open) => !open && onClose()}
			title={t(copy.title)}
			question={t(copy.question)}
			confirmLabel={t(copy.action)}
			data-id={copy.dataId}
			onCloseAutoFocus={onCloseAutoFocus}
			onConfirm={async () => {
				if (confirm) await onConfirm(confirm);
			}}
		>
			{t(copy.body)}
		</ConfirmModal>
	);
}
