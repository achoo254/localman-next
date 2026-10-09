import {
	IconCopy,
	IconDotsVertical,
	IconPencil,
	IconTrash,
} from "@tabler/icons-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { IconButton } from "../../components/ui/icon-button";
import type { Project } from "./projects-api";

export type ProjectAction = "clone" | "edit" | "delete";

export interface ProjectActionsMenuProps {
	project: Project;
	onAction: (action: ProjectAction, project: Project) => void;
}

/**
 * ⋮ menu of a project row. Collaborators can only clone; edit and delete
 * belong to the owner. Collaborators and Magic link entries come later.
 */
export function ProjectActionsMenu({
	project,
	onAction,
}: ProjectActionsMenuProps) {
	const owner = project.role === "owner";
	const base = `project-row-${project.id}`;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<IconButton
					label={`Tuỳ chọn cho ${project.name}`}
					icon={<IconDotsVertical size={20} aria-hidden="true" />}
					data-id={`${base}-menu`}
					className="data-[state=open]:bg-fg/6 data-[state=open]:text-fg"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent data-id="project-menu">
				<DropdownMenuItem
					data-id="project-menu-clone"
					icon={<IconCopy size={16} aria-hidden="true" />}
					onSelect={() => onAction("clone", project)}
				>
					Nhân bản
				</DropdownMenuItem>
				{owner ? (
					<>
						<DropdownMenuItem
							data-id="project-menu-edit"
							icon={<IconPencil size={16} aria-hidden="true" />}
							onSelect={() => onAction("edit", project)}
						>
							Sửa
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							danger
							data-id="project-menu-delete"
							icon={<IconTrash size={16} aria-hidden="true" />}
							onSelect={() => onAction("delete", project)}
						>
							Xoá
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
