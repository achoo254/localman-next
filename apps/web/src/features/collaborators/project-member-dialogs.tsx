import type { PlanId } from "@localman/shared/constants";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type { Project } from "../../pages/projects/projects-api";
import { CollaboratorsModal } from "./collaborators-modal";
import { MagicLinkModal } from "./magic-link-modal";

export type MemberDialogKind = "collaborators" | "magic-link";

export interface ProjectMemberDialogsProps {
	kind: MemberDialogKind | null;
	project: Project;
	plan: PlanId;
	onClose: () => void;
	/** Opens "Quản lý gói" for the member limit. */
	onPlans: () => void;
	/** Owner plus accepted members (keep stable). */
	onMemberCount: (projectId: string, count: number) => void;
	onProjectChange: (project: Project) => void;
	/** The collaborator left; the project is gone from the cache already. */
	onLeft: (project: Project) => void;
	/** Where focus goes after leaving: the dialog's trigger no longer exists. */
	focusAfterLeave: () => HTMLElement | null;
}

/**
 * Collaborators and magic link dialogs of one project, shared by the
 * projects list (⋮ menu) and the project page.
 */
export function ProjectMemberDialogs({
	kind,
	project,
	plan,
	onClose,
	onPlans,
	onMemberCount,
	onProjectChange,
	onLeft,
	focusAfterLeave,
}: ProjectMemberDialogsProps) {
	const queryClient = useQueryClient();
	const leaveTarget = useRef<HTMLElement | null>(null);
	if (kind === "magic-link") {
		return (
			<MagicLinkModal
				project={project}
				plan={plan}
				onOpenChange={(open) => !open && onClose()}
				onPlans={onPlans}
			/>
		);
	}
	if (kind !== "collaborators") return null;
	return (
		<CollaboratorsModal
			project={project}
			plan={plan}
			onOpenChange={(open) => !open && onClose()}
			onPlans={onPlans}
			onMemberCount={onMemberCount}
			onProjectChange={onProjectChange}
			onLeft={(gone) => {
				leaveTarget.current = focusAfterLeave();
				onLeft(gone);
				// No access any more: never show the cached project again.
				queryClient.removeQueries({ queryKey: ["project", gone.id] });
			}}
			onCloseAutoFocus={(event) => {
				const target = leaveTarget.current;
				if (!target) return;
				leaveTarget.current = null;
				event.preventDefault();
				target.focus();
			}}
		/>
	);
}
