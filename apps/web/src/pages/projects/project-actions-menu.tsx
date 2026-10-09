import {
	IconCopy,
	IconDotsVertical,
	IconLink,
	IconPencil,
	IconTrash,
	IconUsers,
} from "@tabler/icons-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import type { Project } from "./projects-api";

export type ProjectAction =
	| "collaborators"
	| "magic-link"
	| "clone"
	| "edit"
	| "delete";

export interface ProjectActionsMenuProps {
	project: Project;
	onAction: (action: ProjectAction, project: Project) => void;
}

/**
 * ⋮ menu of a project row. Everyone sees the members ("Collaborators":
 * the owner manages them, a collaborator may leave) and can clone; the
 * magic link, edit and delete belong to the owner.
 */
export function ProjectActionsMenu({
	project,
	onAction,
}: ProjectActionsMenuProps) {
	const t = useT();
	const owner = project.role === "owner";
	const base = `project-row-${project.id}`;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<IconButton
					label={t("projects.menu.trigger", { name: project.name })}
					icon={<IconDotsVertical size={20} aria-hidden="true" />}
					data-id={`${base}-menu`}
					className="data-[state=open]:bg-fg/6 data-[state=open]:text-fg"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent data-id="project-menu">
				<DropdownMenuItem
					data-id="project-menu-collaborators"
					icon={<IconUsers size={16} aria-hidden="true" />}
					onSelect={() => onAction("collaborators", project)}
				>
					{t("projects.menu.collaborators")}
				</DropdownMenuItem>
				{owner ? (
					<DropdownMenuItem
						data-id="project-menu-magic-link"
						icon={<IconLink size={16} aria-hidden="true" />}
						onSelect={() => onAction("magic-link", project)}
					>
						Magic link
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					data-id="project-menu-clone"
					icon={<IconCopy size={16} aria-hidden="true" />}
					onSelect={() => onAction("clone", project)}
				>
					{t("projects.menu.clone")}
				</DropdownMenuItem>
				{owner ? (
					<>
						<DropdownMenuItem
							data-id="project-menu-edit"
							icon={<IconPencil size={16} aria-hidden="true" />}
							onSelect={() => onAction("edit", project)}
						>
							{t("projects.menu.edit")}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							danger
							data-id="project-menu-delete"
							icon={<IconTrash size={16} aria-hidden="true" />}
							onSelect={() => onAction("delete", project)}
						>
							{t("projects.menu.delete")}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
