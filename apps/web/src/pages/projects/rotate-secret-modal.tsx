import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useToast } from "../../components/ui/toast";
import { useFeatures } from "../../config/features";
import { errorMessage } from "../../lib/api-client";
import {
	type Project,
	previewRotateSecret,
	rotateSecret,
} from "./projects-api";

export interface RotateSecretModalProps {
	project: Project;
	onOpenChange: (open: boolean) => void;
	/** The project with its new secret and mock URL. */
	onRotated?: (project: Project) => void;
	/** Where focus goes on close when the trigger is gone. */
	onCloseAutoFocus?: (event: Event) => void;
}

type Preview =
	| { status: "loading" }
	| { status: "ready"; collaborators: number }
	| { status: "error"; error: unknown };

function collaboratorsText(preview: Preview): string {
	if (preview.status === "loading") return "Đang kiểm tra cộng tác viên…";
	if (preview.status === "error") return errorMessage(preview.error);
	if (preview.collaborators === 0) return "Project chưa có cộng tác viên nào.";
	return `${preview.collaborators} cộng tác viên sẽ nhận thông báo kèm URL mới.`;
}

/**
 * "Đổi URL mock": a new secret, so the old URL stops answering at once.
 * The dry run says how many collaborators share the project. Updates the
 * cached project, so the detail page shows the new URL.
 */
export function RotateSecretModal({
	project,
	onOpenChange,
	onRotated,
	onCloseAutoFocus,
}: RotateSecretModalProps) {
	const toast = useToast();
	const flags = useFeatures();
	const queryClient = useQueryClient();
	const [preview, setPreview] = useState<Preview>({ status: "loading" });

	useEffect(() => {
		let current = true;
		previewRotateSecret(project.id).then(
			(collaborators) =>
				current && setPreview({ status: "ready", collaborators }),
			(error: unknown) => current && setPreview({ status: "error", error }),
		);
		return () => {
			current = false;
		};
	}, [project.id]);

	return (
		<ConfirmModal
			open
			onOpenChange={onOpenChange}
			title="Đổi URL mock"
			question={`Đổi URL mock của ${project.name}?`}
			confirmLabel="Đổi URL"
			confirmDisabled={preview.status !== "ready"}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-rotate-secret"
			onConfirm={async () => {
				const saved = await rotateSecret(project.id);
				queryClient.setQueryData(["project", saved.id], saved);
				onRotated?.(saved);
				toast.show({
					title: "Đã đổi URL mock",
					description: "Cập nhật URL mới ở frontend và tool đang dùng.",
				});
			}}
		>
			<p className="m-0">
				URL cũ ngừng hoạt động ngay. Frontend hoặc tool đang gọi URL cũ phải cập
				nhật sang URL mới.
			</p>
			{flags.mockMcp ? (
				<p className="m-0" data-id="modal-rotate-secret-mcp">
					URL MCP cũng đổi theo; agent đã thêm URL cũ phải thêm lại.
				</p>
			) : null}
			<p className="m-0" data-id="modal-rotate-secret-collaborators">
				{collaboratorsText(preview)}
			</p>
		</ConfirmModal>
	);
}
