import { useRef } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useI18n } from "../../i18n/i18n-context";
import { memberName } from "./collaborator-labels";
import type { Collaborator } from "./collaborators-api";

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
 * "Remove {name} from {project}?" for the owner, "Leave {project}?" for a
 * collaborator. Keeps showing the last confirmation while it animates out.
 */
export function MemberConfirmModal({
	projectName,
	confirm,
	onClose,
	onConfirm,
	onCloseAutoFocus,
}: MemberConfirmModalProps) {
	const i18n = useI18n();
	const { t } = i18n;
	const last = useRef(confirm);
	if (confirm) last.current = confirm;
	const shown = confirm ?? last.current;
	const leave = shown?.leave ?? false;
	const name = shown ? memberName(shown.item, i18n) : "";
	return (
		<ConfirmModal
			open={confirm !== null}
			onOpenChange={(open) => !open && onClose()}
			title={t(
				leave
					? "collaborators.confirm.leaveTitle"
					: "collaborators.confirm.removeTitle",
			)}
			question={
				leave
					? t("collaborators.confirm.leaveQuestion", { project: projectName })
					: t("collaborators.confirm.removeQuestion", {
							name,
							project: projectName,
						})
			}
			confirmLabel={t(
				leave
					? "collaborators.confirm.leaveAction"
					: "collaborators.confirm.removeAction",
			)}
			data-id={leave ? "modal-leave-project" : "modal-remove-collaborator"}
			onCloseAutoFocus={onCloseAutoFocus}
			onConfirm={async () => {
				if (confirm) await onConfirm(confirm);
			}}
		>
			{t(
				leave
					? "collaborators.confirm.leaveBody"
					: "collaborators.confirm.removeBody",
			)}
		</ConfirmModal>
	);
}
