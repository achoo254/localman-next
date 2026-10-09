import { useEffect, useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useI18n } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { Translator } from "../../i18n/translate";
import {
	type DeleteDependent,
	type Project,
	deleteProject,
	previewDeleteProject,
} from "./projects-api";

const MONO = {
	code: (chunk: string) => <span className="font-mono">{chunk}</span>,
};

type Preview =
	| { status: "loading" }
	| { status: "ready"; dependents: DeleteDependent[] }
	| { status: "unavailable" };

/** "3 resources", or the raw kind for one the dictionary does not know. */
function dependentText(
	{ kind, count }: DeleteDependent,
	{ t, formatNumber }: Translator,
): string {
	switch (kind) {
		case "resources":
			return t("projects.delete.kinds.resources", { count });
		case "records":
			return t("projects.delete.kinds.records", { count });
		case "collaborators":
			return t("projects.delete.kinds.collaborators", { count });
		case "mcpTokens":
			return t("projects.delete.kinds.mcpTokens", { count });
		default:
			return `${formatNumber(count)} ${kind}`;
	}
}

/** Sentence listing what goes with the project, or null when nothing does. */
function summary(
	dependents: DeleteDependent[],
	i18n: Translator,
): string | null {
	const { t } = i18n;
	const parts = dependents
		.filter((item) => item.count > 0)
		.map((item) => dependentText(item, i18n));
	if (parts.length === 0) return null;
	return t("projects.delete.summary", {
		items: parts.join(t("projects.delete.separator")),
	});
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
	const i18n = useI18n();
	const { t } = i18n;
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
			? t("projects.delete.checking")
			: preview.status === "ready"
				? summary(preview.dependents, i18n)
				: null;

	return (
		<ConfirmModal
			open
			onOpenChange={onOpenChange}
			title={t("projects.delete.title")}
			data-id="modal-delete-project"
			question={renderRich(
				t("projects.delete.question", { name: project.name }),
				MONO,
			)}
			confirmLabel={t("projects.delete.confirm")}
			onConfirm={async () => {
				await deleteProject(project.id);
				onDeleted(project);
			}}
		>
			{note ? <span data-id="modal-delete-project-summary">{note}</span> : null}
			<span>{t("projects.delete.irreversible")}</span>
		</ConfirmModal>
	);
}
