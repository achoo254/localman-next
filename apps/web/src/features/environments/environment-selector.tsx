import { IconChevronDown } from "@tabler/icons-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import { ColorDot } from "./environment-color";
import {
	useActiveEnvironment,
	useEnvironmentList,
	useSetActiveEnvironment,
} from "./use-environments";
import { useOpenVariablesPage } from "./use-open-variables-page";

const NONE = "none";

/**
 * The environment requests use, at the top right of the workbench: each
 * person picks their own; "No environment" uses none.
 */
export function EnvironmentSelector({ workspaceId }: { workspaceId: string }) {
	const t = useT();
	const list = useEnvironmentList(workspaceId);
	const active = useActiveEnvironment(workspaceId);
	const setActive = useSetActiveEnvironment(workspaceId);
	const { openEnvironment } = useOpenVariablesPage();
	const items = list.data ?? [];
	const current = items.find((env) => env.id === active.data?.environmentId);
	const label = current?.name ?? t("environments.selector.none");
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				data-id="environment-selector"
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
					<DropdownMenuRadioItem
						value={NONE}
						data-id="environment-selector-none"
					>
						{t("environments.selector.none")}
					</DropdownMenuRadioItem>
					{items.map((env) => (
						<DropdownMenuRadioItem
							key={env.id}
							value={env.id}
							data-id="environment-selector-item"
						>
							<ColorDot color={env.color} />
							<span className="min-w-0 truncate">{env.name}</span>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				{current ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							data-id="environment-selector-edit"
							onSelect={() => openEnvironment(current.id, current.name)}
						>
							{t("environments.selector.edit", { name: current.name })}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
