import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useToast } from "../../components/ui/toast";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
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

function collaboratorsText(preview: Preview, t: Translate): string {
	if (preview.status === "loading") return t("projects.rotate.checking");
	if (preview.status === "error") return errorMessage(preview.error);
	if (preview.collaborators === 0) return t("projects.rotate.noCollaborators");
	return t("projects.rotate.notify", { count: preview.collaborators });
}

/**
 * "Change mock URL": a new secret, so the old URL stops answering at once.
 * The dry run says how many collaborators share the project. Updates the
 * cached project, so the detail page shows the new URL.
 */
export function RotateSecretModal({
	project,
	onOpenChange,
	onRotated,
	onCloseAutoFocus,
}: RotateSecretModalProps) {
	const t = useT();
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
			title={t("projects.rotate.title")}
			question={t("projects.rotate.question", { name: project.name })}
			confirmLabel={t("projects.rotate.confirm")}
			confirmDisabled={preview.status !== "ready"}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-rotate-secret"
			onConfirm={async () => {
				const saved = await rotateSecret(project.id);
				queryClient.setQueryData(["project", saved.id], saved);
				onRotated?.(saved);
				toast.show({
					title: t("projects.rotate.done"),
					description: t("projects.rotate.doneHint"),
				});
			}}
		>
			<p className="m-0">{t("projects.rotate.oldStops")}</p>
			{flags.mockMcp ? (
				<p className="m-0" data-id="modal-rotate-secret-mcp">
					{t("projects.rotate.mcp")}
				</p>
			) : null}
			<p className="m-0" data-id="modal-rotate-secret-collaborators">
				{collaboratorsText(preview, t)}
			</p>
		</ConfirmModal>
	);
}
