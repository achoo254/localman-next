import { useRef } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { collaboratorLabel } from "./collaborator-row";
import type { Collaborator } from "./collaborators-api";

/** Short name for confirmations: display name, @username or the email. */
export function memberName(item: Collaborator): string {
	if (item.user) return item.user.name || `@${item.user.username}`;
	return item.inviteeEmail ?? collaboratorLabel(item);
}

export interface MemberConfirm {
	item: Collaborator;
	/** The signed-in collaborator leaving, rather than the owner removing. */
	leave: boolean;
}

export interface MemberConfirmModalProps {
	projectName: string;
	confirm: MemberConfirm | null;
	onClose: () => void;
	onConfirm: (confirm: MemberConfirm) => Promise<void>;
	onCloseAutoFocus: (event: Event) => void;
}

/**
 * "Xoá {name} khỏi {project}?" for the owner, "Rời {project}?" for a
 * collaborator. Keeps showing the last confirmation while it animates out.
 */
export function MemberConfirmModal({
	projectName,
	confirm,
	onClose,
	onConfirm,
	onCloseAutoFocus,
}: MemberConfirmModalProps) {
	const last = useRef(confirm);
	if (confirm) last.current = confirm;
	const shown = confirm ?? last.current;
	const leave = shown?.leave ?? false;
	const name = shown ? memberName(shown.item) : "";
	return (
		<ConfirmModal
			open={confirm !== null}
			onOpenChange={(open) => !open && onClose()}
			title={leave ? "Rời project" : "Xoá cộng tác viên"}
			question={
				leave ? `Rời ${projectName}?` : `Xoá ${name} khỏi ${projectName}?`
			}
			confirmLabel={leave ? "Rời project" : "Xoá khỏi project"}
			data-id={leave ? "modal-leave-project" : "modal-remove-collaborator"}
			onCloseAutoFocus={onCloseAutoFocus}
			onConfirm={async () => {
				if (confirm) await onConfirm(confirm);
			}}
		>
			{leave
				? "Bạn sẽ mất quyền truy cập cho tới khi được mời lại."
				: "Họ sẽ mất quyền truy cập project ngay và không tham gia lại được bằng magic link. Muốn họ quay lại, hãy gửi lời mời mới."}
		</ConfirmModal>
	);
}
