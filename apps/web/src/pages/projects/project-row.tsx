import { Link } from "react-router";
import { Badge } from "../../components/ui/badge";
import { cardClassName } from "../../components/ui/card";
import { useT } from "../../i18n/i18n-context";
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
	const t = useT();
	const shared = project.role === "collaborator";
	const ownerName =
		project.owner.name ||
		project.owner.username ||
		t("projects.row.ownerFallback");
	const collaborators = project.memberCount - 1;
	return (
		<li
			data-id={`project-row-${project.id}`}
			className={cn(
				cardClassName,
				ROW_ACTIVE,
				"flex items-center gap-2 py-2 pr-2 pl-3",
			)}
		>
			<Link
				to={`/projects/${encodeURIComponent(project.id)}`}
				data-id={`project-row-${project.id}-open`}
				className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-fg no-underline"
			>
				<ProjectAvatar name={project.name} />
				<div className="grid min-w-0">
					<span className="flex min-w-0 items-center gap-2">
						<span className="truncate font-bold font-mono">{project.name}</span>
						{shared ? (
							<Badge
								tone="info"
								title={t("projects.row.ownedBy", { owner: ownerName })}
							>
								{t("projects.row.invited")}
							</Badge>
						) : null}
					</span>
					<span className="truncate font-mono text-muted text-xs">
						{project.prefix || "/"} ·{" "}
						{/* Before the long URL, so truncation never hides it. */}
						{collaborators > 0
							? `${t("projects.row.collaborators", { count: collaborators })} · `
							: null}
						{project.mockBaseUrl}
					</span>
				</div>
			</Link>
			<ProjectActionsMenu project={project} onAction={onAction} />
		</li>
	);
}
