import { Badge } from "../../components/ui/badge";
import { cardClassName } from "../../components/ui/card";
import { cn } from "../../lib/cn";
import { type ProjectAction, ProjectActionsMenu } from "./project-actions-menu";
import { ProjectAvatar } from "./project-avatar";
import type { Project } from "./projects-api";

/** Hover and "menu open" share one highlighted look (literal classes so Tailwind sees them). */
const ROW_ACTIVE =
	"transition-[border-color,box-shadow] " +
	"hover:border-[color-mix(in_srgb,var(--c-primary)_45%,var(--c-border))] hover:shadow-md " +
	"has-[[data-state=open]]:border-[color-mix(in_srgb,var(--c-primary)_45%,var(--c-border))] has-[[data-state=open]]:shadow-md";

export interface ProjectRowProps {
	project: Project;
	onAction: (action: ProjectAction, project: Project) => void;
}

/** List card: avatar, name, prefix and mock URL, then the ⋮ menu. */
export function ProjectRow({ project, onAction }: ProjectRowProps) {
	const shared = project.role === "collaborator";
	const ownerName =
		project.owner.name || project.owner.username || "người khác";
	return (
		<li
			data-id={`project-row-${project.id}`}
			className={cn(
				cardClassName,
				ROW_ACTIVE,
				"flex items-center gap-2 py-2 pr-2 pl-3",
			)}
		>
			<div className="flex min-w-0 flex-1 items-center gap-3 p-2">
				<ProjectAvatar name={project.name} />
				<div className="grid min-w-0">
					<span className="flex min-w-0 items-center gap-2">
						<span className="truncate font-bold font-mono">{project.name}</span>
						{shared ? (
							<Badge tone="info" title={`Project của ${ownerName}`}>
								Được mời
							</Badge>
						) : null}
					</span>
					<span className="truncate font-mono text-muted text-xs">
						{project.prefix || "/"} · {project.mockBaseUrl}
					</span>
				</div>
			</div>
			<ProjectActionsMenu project={project} onAction={onAction} />
		</li>
	);
}
