import type { PlanId } from "@localman/shared/constants";
import { useEffect, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import {
	CopyField,
	type CopyFieldHandle,
} from "../../components/ui/copy-field";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useToast } from "../../components/ui/toast";
import { errorMessage } from "../../lib/api-client";
import { formatDate } from "../../lib/format";
import type { Project } from "../../pages/projects/projects-api";
import { MagicLinkAction } from "./magic-link-action";
import { MagicLinkStatus } from "./magic-link-status";
import { seatsFull } from "./member-seats-gate";
import { useMagicLink } from "./use-magic-link";

export interface MagicLinkModalProps {
	project: Project;
	/** The owner's plan (only owners open this dialog). */
	plan: PlanId;
	onOpenChange: (open: boolean) => void;
	onPlans: () => void;
}

type Confirm = "regenerate" | "revoke" | null;

/**
 * The project's reusable invite link: create, replace or revoke it. The
 * link itself is shown only right after creating it.
 */
export function MagicLinkModal({
	project,
	plan,
	onOpenChange,
	onPlans,
}: MagicLinkModalProps) {
	const toast = useToast();
	const magic = useMagicLink(project.id);
	const { view, seats } = magic;
	const [confirm, setConfirm] = useState<Confirm>(null);
	// Keep the last confirmation's text while it animates out.
	const lastConfirm = useRef<Confirm>(null);
	if (confirm) lastConfirm.current = confirm;
	const shown = confirm ?? lastConfirm.current;
	const primary = useRef<HTMLButtonElement>(null);
	const copyField = useRef<CopyFieldHandle>(null);
	const created = view.status === "ready" ? view.created : null;
	const status = view.status === "ready" ? view.link.status : null;

	// Focus follows the state: the main action once loaded, the copy button
	// once a link exists (unless focus already moved somewhere else).
	useEffect(() => {
		if (created) {
			copyField.current?.focusCopyButton();
			return;
		}
		const active = document.activeElement;
		if (status && (!active || active.getAttribute("role") === "dialog")) {
			primary.current?.focus();
		}
	}, [created, status]);

	return (
		<Modal
			open
			onOpenChange={onOpenChange}
			title={`Magic link · ${project.name}`}
			initialFocusRef={primary}
			data-id="modal-magic-link"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button data-id="modal-magic-link-close">Đóng</Button>
					</ModalClose>
					<MagicLinkAction
						ref={primary}
						created={created !== null}
						status={status}
						creating={magic.creating}
						onCopy={() => void copyField.current?.copy()}
						onCreate={() => void magic.create()}
						onRegenerate={() => setConfirm("regenerate")}
					/>
				</ModalFooter>
			}
		>
			<p className="m-0 text-muted text-sm">
				Ai đã đăng nhập và mở link này sẽ tham gia <b>{project.name}</b> với vai
				trò cộng tác viên. Link dùng được nhiều lần, hết hạn sau 7 ngày. Bạn có
				thể tạo link mới hoặc thu hồi bất cứ lúc nào.
			</p>
			{seats && seatsFull(seats) && view.status === "ready" ? (
				<Alert tone="warning" data-id="modal-magic-link-full">
					Project đã đủ {seats.used}/{seats.max} thành viên. Người mở link sẽ
					không tham gia được cho tới khi bạn xoá bớt thành viên.
					{plan === "free" ? (
						<Button
							size="sm"
							data-id="modal-magic-link-plans"
							className="mt-2 flex"
							onClick={onPlans}
						>
							Xem gói
						</Button>
					) : null}
				</Alert>
			) : null}
			{view.status === "loading" ? (
				<output
					data-id="modal-magic-link-loading"
					className="block font-mono text-muted text-sm"
				>
					Đang tải trạng thái link…
				</output>
			) : null}
			{view.status === "error" ? (
				<div className="grid justify-items-start gap-3">
					<Alert tone="danger" data-id="modal-magic-link-error">
						{errorMessage(view.error)}
					</Alert>
					<Button
						data-id="modal-magic-link-retry"
						onClick={() => void magic.load()}
					>
						Thử lại
					</Button>
				</div>
			) : null}
			{view.status === "ready" && created ? (
				<div className="grid gap-3">
					<CopyField
						key={created}
						ref={copyField}
						label="Magic link"
						hideLabel
						value={created}
						data-id="modal-magic-link-input"
						copyDataId="modal-magic-link-copy"
					/>
					<Alert tone="warning">
						Link chỉ hiện lần này. Hãy sao chép trước khi đóng.
					</Alert>
					<p
						data-id="modal-magic-link-expiry"
						className="m-0 text-muted text-[0.8125rem]"
					>
						Hết hạn {view.link.expiresAt ? formatDate(view.link.expiresAt) : ""}
						.
					</p>
				</div>
			) : null}
			{view.status === "ready" && !created ? (
				<MagicLinkStatus
					link={view.link}
					onRevoke={() => setConfirm("revoke")}
				/>
			) : null}
			<ConfirmModal
				open={confirm !== null}
				onOpenChange={(open) => !open && setConfirm(null)}
				title={shown === "revoke" ? "Thu hồi magic link" : "Tạo link mới"}
				question={
					shown === "revoke" ? "Thu hồi magic link?" : "Tạo magic link mới?"
				}
				confirmLabel={shown === "revoke" ? "Thu hồi" : "Tạo link mới"}
				data-id={
					shown === "revoke"
						? "modal-revoke-magic-link"
						: "modal-regenerate-magic-link"
				}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					primary.current?.focus();
				}}
				onConfirm={async () => {
					if (confirm === "revoke") {
						await magic.revoke();
						toast.show({ title: "Đã thu hồi magic link" });
					} else {
						await magic.regenerate();
					}
				}}
			>
				{shown === "revoke"
					? "Người mở link sẽ không tham gia được nữa. Người đã tham gia vẫn giữ quyền."
					: "Link cũ ngừng hoạt động ngay. Người đã tham gia vẫn giữ quyền."}
			</ConfirmModal>
		</Modal>
	);
}
