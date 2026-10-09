import { useEffect, useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { formatNumber } from "../../lib/format";
import {
	type DeleteDependent,
	type Project,
	deleteProject,
	previewDeleteProject,
} from "./projects-api";

const KIND_LABELS: Readonly<Record<string, string>> = {
	resources: "resource",
	records: "bản ghi dữ liệu",
	collaborators: "cộng tác viên",
	mcpTokens: "token MCP",
};

type Preview =
	| { status: "loading" }
	| { status: "ready"; dependents: DeleteDependent[] }
	| { status: "unavailable" };

/** Sentence listing what goes with the project, or null when nothing does. */
function summary(dependents: DeleteDependent[]): string | null {
	const parts = dependents
		.filter((item) => item.count > 0)
		.map(
			(item) =>
				`${formatNumber(item.count)} ${KIND_LABELS[item.kind] ?? item.kind}`,
		);
	return parts.length > 0 ? `Sẽ xoá kèm ${parts.join(", ")}.` : null;
}

export interface DeleteProjectModalProps {
	project: Project;
	onOpenChange: (open: boolean) => void;
	onDeleted: (project: Project) => void;
}

/**
 * Asks the API for a dry run first so the warning can say what goes with
 * the project, then deletes for real. Mount it only while open.
 */
export function DeleteProjectModal({
	project,
	onOpenChange,
	onDeleted,
}: DeleteProjectModalProps) {
	const [preview, setPreview] = useState<Preview>({ status: "loading" });

	useEffect(() => {
		let active = true;
		previewDeleteProject(project.id).then(
			(dependents) => active && setPreview({ status: "ready", dependents }),
			// The warning still stands without the counts; the real delete
			// reports its own error if the project is gone.
			() => active && setPreview({ status: "unavailable" }),
		);
		return () => {
			active = false;
		};
	}, [project.id]);

	const note =
		preview.status === "loading"
			? "Đang kiểm tra dữ liệu liên quan…"
			: preview.status === "ready"
				? summary(preview.dependents)
				: null;

	return (
		<ConfirmModal
			open
			onOpenChange={onOpenChange}
			title="Xoá project"
			data-id="modal-delete-project"
			question={
				<>
					Xoá “<span className="font-mono">{project.name}</span>”?
				</>
			}
			confirmLabel="Xoá project"
			onConfirm={async () => {
				await deleteProject(project.id);
				onDeleted(project);
			}}
		>
			{note ? <span data-id="modal-delete-project-summary">{note}</span> : null}
			<span>Toàn bộ dữ liệu sẽ bị xoá. Hành động này không thể hoàn tác.</span>
		</ConfirmModal>
	);
}
