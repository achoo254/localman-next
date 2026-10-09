import { IconKey } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import type { Project } from "../../pages/projects/projects-api";
import { RotateSecretModal } from "../../pages/projects/rotate-secret-modal";

export interface RotateSecretHintProps {
	project: Project;
	onRotated: (project: Project) => void;
}

/**
 * Shown after the owner removed a member who had joined: removal ends
 * their Localman access, but they may still know the mock URL.
 */
export function RotateSecretHint({
	project,
	onRotated,
}: RotateSecretHintProps) {
	const t = useT();
	const [open, setOpen] = useState(false);
	const [done, setDone] = useState(false);
	const doneNote = useRef<HTMLDivElement>(null);

	return (
		<>
			{done ? (
				<Alert
					ref={doneNote}
					tabIndex={-1}
					tone="success"
					data-id="modal-collaborators-rotate-done"
				>
					{t("collaborators.rotate.done")}
				</Alert>
			) : (
				<Alert tone="info" data-id="modal-collaborators-rotate-hint">
					{t("collaborators.rotate.hint")}
					<Button
						size="sm"
						data-id="modal-collaborators-rotate-secret"
						className="mt-2 flex"
						leadingIcon={<IconKey size={16} aria-hidden="true" />}
						onClick={() => setOpen(true)}
					>
						{t("collaborators.rotate.action")}
					</Button>
				</Alert>
			)}
			{open ? (
				<RotateSecretModal
					project={project}
					onOpenChange={(next) => !next && setOpen(false)}
					onRotated={(saved) => {
						setDone(true);
						onRotated(saved);
					}}
					onCloseAutoFocus={(event) => {
						// The button is gone once rotated; land on the note instead.
						if (!doneNote.current) return;
						event.preventDefault();
						doneNote.current.focus();
					}}
				/>
			) : null}
		</>
	);
}
