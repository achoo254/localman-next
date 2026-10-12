import { IconChevronDown, IconPlus, IconSettings } from "@tabler/icons-react";
import { useId } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import { requestSidebarSection } from "../api-client/workbench/sidebar-section-request";
import { ColorDot } from "./environment-color";
import { useCreateEnvironment } from "./use-create-environment";
import {
	useActiveEnvironment,
	useEnvironmentList,
	useSetActiveEnvironment,
} from "./use-environments";
import { useOpenVariablesPage } from "./use-open-variables-page";

const NONE = "none";

export interface EnvironmentSelectorProps {
	workspaceId: string;
	/** Admins and Editors of the workspace create environments. */
	canCreate: boolean;
}

/**
 * The environment requests use, at the top right of the workbench: each
 * person picks their own; "No environment" uses none. Create environment
 * opens the new one and makes it active.
 */
export function EnvironmentSelector({
	workspaceId,
	canCreate,
}: EnvironmentSelectorProps) {
	const t = useT();
	const list = useEnvironmentList(workspaceId);
	const active = useActiveEnvironment(workspaceId);
	const setActive = useSetActiveEnvironment(workspaceId);
	const { openEnvironment } = useOpenVariablesPage();
	const create = useCreateEnvironment(workspaceId, { activate: true });
	const readOnlyId = useId();
	const items = list.data ?? [];
	const current = items.find((env) => env.id === active.data?.environmentId);
	const label = current?.name ?? t("environments.selector.none");
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				data-id="tabbar-env-select"
				aria-label={t("environments.selector.label", { name: label })}
				className="flex min-h-8 max-w-56 cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface px-2 text-xs hover:bg-fg/4 pointer-coarse:min-h-10"
			>
				{current ? <ColorDot color={current.color} /> : null}
				<span className="min-w-0 truncate">{label}</span>
				<IconChevronDown
					size={14}
					aria-hidden="true"
					className="flex-none text-icon-muted"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuRadioGroup
					value={current?.id ?? NONE}
					onValueChange={(value) =>
						setActive.mutate(value === NONE ? null : value)
					}
				>
					<DropdownMenuRadioItem value={NONE} data-id="env-select-none">
						{t("environments.selector.none")}
					</DropdownMenuRadioItem>
					{items.map((env) => (
						<DropdownMenuRadioItem
							key={env.id}
							value={env.id}
							data-id="env-select-item"
							data-environment={env.id}
						>
							<ColorDot color={env.color} />
							<span className="min-w-0 truncate">{env.name}</span>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				{current ? (
					<DropdownMenuItem
						data-id="env-select-edit"
						onSelect={() => openEnvironment(current.id, current.name)}
					>
						{t("environments.selector.edit", { name: current.name })}
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					data-id="env-select-create"
					icon={<IconPlus size={16} aria-hidden="true" />}
					disabled={!canCreate || create.isPending}
					aria-describedby={canCreate ? undefined : readOnlyId}
					onSelect={() => create.mutate()}
				>
					{t("environments.selector.create")}
				</DropdownMenuItem>
				{canCreate ? null : (
					<DropdownMenuLabel id={readOnlyId} data-id="env-select-readonly">
						{t("environments.sidebar.readOnly")}
					</DropdownMenuLabel>
				)}
				<DropdownMenuItem
					data-id="env-select-manage"
					icon={<IconSettings size={16} aria-hidden="true" />}
					onSelect={() => requestSidebarSection("environments")}
				>
					{t("environments.selector.manage")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
