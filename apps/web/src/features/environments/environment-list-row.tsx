import type { EnvironmentSummary } from "@localman/shared/api-client";
import {
	IconCircleCheck,
	IconCopy,
	IconDots,
	IconTrash,
} from "@tabler/icons-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { ColorDot } from "./environment-color";

export interface EnvironmentListRowProps {
	environment: EnvironmentSummary;
	active: boolean;
	opened: boolean;
	/** Admin or Editor of the workspace: duplicate lands there. */
	canDuplicate: boolean;
	/** Editor of it and Admin or Editor of the workspace. */
	canDelete: boolean;
	onOpen: () => void;
	onToggleActive: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}

/** One environment in the sidebar: color, name, active mark and its menu. */
export function EnvironmentListRow(props: EnvironmentListRowProps) {
	const t = useT();
	const { environment } = props;
	const { canDuplicate, canDelete } = props;
	return (
		<li
			data-id="environment-row"
			data-environment={environment.id}
			className={cn(
				"group flex min-h-9 items-center gap-1 rounded-sm pr-1",
				props.opened ? "bg-primary/8" : "hover:bg-fg/4",
			)}
		>
			<button
				type="button"
				data-id="environment-row-open"
				aria-current={props.opened ? "page" : undefined}
				className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent px-3 text-left text-sm"
				onClick={props.onOpen}
			>
				<ColorDot color={environment.color} />
				<span className="min-w-0 flex-1 truncate">{environment.name}</span>
				{props.active ? (
					<>
						<IconCircleCheck
							size={16}
							aria-hidden="true"
							className="flex-none text-primary"
						/>
						<span className="sr-only">
							{t("environments.sidebar.activeMark")}
						</span>
					</>
				) : null}
			</button>
			<DropdownMenu>
				<DropdownMenuTrigger
					data-id="environment-row-more"
					aria-label={t("environments.page.more", { name: environment.name })}
					className="grid size-8 flex-none cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-icon-muted hover:bg-fg/6 hover:text-fg pointer-coarse:size-10"
				>
					<IconDots size={16} aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						data-id="environment-row-active"
						icon={<IconCircleCheck size={16} aria-hidden="true" />}
						onSelect={props.onToggleActive}
					>
						{props.active
							? t("environments.sidebar.deactivate")
							: t("environments.page.setActive")}
					</DropdownMenuItem>
					{canDuplicate ? (
						<DropdownMenuItem
							data-id="environment-row-duplicate"
							icon={<IconCopy size={16} aria-hidden="true" />}
							onSelect={props.onDuplicate}
						>
							{t("environments.menu.duplicate")}
						</DropdownMenuItem>
					) : null}
					{canDelete ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								danger
								data-id="environment-row-delete"
								icon={<IconTrash size={16} aria-hidden="true" />}
								onSelect={props.onDelete}
							>
								{t("environments.menu.delete")}
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
		</li>
	);
}
