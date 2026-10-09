import { IconLink, IconUsers } from "@tabler/icons-react";
import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import type { MemberDialogKind } from "../../features/collaborators/project-member-dialogs";
import type { Project } from "../projects/projects-api";

export interface ProjectDetailHeaderProps {
	project: Project;
	onOpen: (kind: MemberDialogKind) => void;
}

/**
 * Breadcrumb "Projects / {name}" and the member entries: "Cộng tác viên"
 * for everyone (a collaborator may leave there), "Magic link" for the owner.
 */
export function ProjectDetailHeader({
	project,
	onOpen,
}: ProjectDetailHeaderProps) {
	const members = project.memberCount - 1;
	return (
		<div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
			<nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
				<Link
					to="/projects"
					data-id="project-detail-back"
					className="font-bold font-mono text-muted text-xl no-underline hover:text-primary"
				>
					Projects
				</Link>
				<span aria-hidden="true" className="font-mono text-icon-muted text-xl">
					/
				</span>
				<h1
					aria-current="page"
					className="m-0 truncate font-bold font-mono text-xl tracking-[-0.01em]"
				>
					{project.name}
				</h1>
			</nav>
			<div className="flex flex-wrap gap-2">
				<Button
					size="sm"
					data-id="project-detail-collaborators"
					leadingIcon={<IconUsers size={16} aria-hidden="true" />}
					onClick={() => onOpen("collaborators")}
				>
					Cộng tác viên{members > 0 ? ` · ${members}` : ""}
				</Button>
				{project.role === "owner" ? (
					<Button
						size="sm"
						data-id="project-detail-magic-link"
						leadingIcon={<IconLink size={16} aria-hidden="true" />}
						onClick={() => onOpen("magic-link")}
					>
						Magic link
					</Button>
				) : null}
			</div>
		</div>
	);
}
