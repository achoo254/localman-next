import { IconChevronDown, IconPlus, IconSettings } from "@tabler/icons-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
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
import { Skeleton } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { CreateWorkspaceModal } from "./create-workspace-modal";
import { useCurrentWorkspace } from "./current-workspace";
import { useWorkspacesEnabled } from "./use-workspaces-enabled";
import { WorkspaceIcon } from "./workspace-icon";

export const WORKSPACE_SETTINGS_PATH = "/workspace/settings";

/**
 * Workspaces belong to the API client: `/api-client`, `/workspace/*` and
 * the pages of shared elements and access requests.
 */
export function isWorkspaceRoute(pathname: string): boolean {
	return (
		pathname === "/api-client" ||
		["/api-client/", "/workspace/", "/elements/", "/access-requests/"].some(
			(prefix) => pathname.startsWith(prefix),
		)
	);
}

function SwitcherMenu() {
	const t = useT();
	const navigate = useNavigate();
	const [creating, setCreating] = useState(false);
	const { query, workspaces, current, select } = useCurrentWorkspace();
	if (query.isPending) {
		return <Skeleton className="h-8 w-32 max-sm:w-20" />;
	}
	const name = current?.name ?? t("workspaces.switcher.heading");
	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						data-id="app-header-workspace"
						aria-label={t("workspaces.switcher.trigger", { name })}
						className="min-w-0 max-w-56 max-sm:max-w-36"
					>
						<WorkspaceIcon type={current?.type ?? "personal"} />
						<span className="min-w-0 truncate">{name}</span>
						<IconChevronDown size={14} aria-hidden="true" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="max-w-80">
					<DropdownMenuLabel>
						{t("workspaces.switcher.heading")}
					</DropdownMenuLabel>
					{workspaces ? (
						<DropdownMenuRadioGroup
							value={current?.id ?? ""}
							onValueChange={select}
						>
							{workspaces.map((workspace) => (
								<DropdownMenuRadioItem
									key={workspace.id}
									value={workspace.id}
									data-id={`ws-menu-${workspace.id}`}
								>
									<WorkspaceIcon type={workspace.type} />
									<span className="min-w-0 flex-1 truncate">
										{workspace.name}
									</span>
									<span className="text-muted text-xs">
										{t(`workspaces.switcher.${workspace.type}`)}
									</span>
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					) : (
						<DropdownMenuItem
							data-id="ws-menu-retry"
							onSelect={() => void query.refetch()}
						>
							{t("workspaces.switcher.loadFailed")} {t("common.cta.retry")}
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						data-id="ws-menu-create"
						icon={<IconPlus size={16} aria-hidden="true" />}
						onSelect={() => setCreating(true)}
					>
						{t("workspaces.switcher.create")}
					</DropdownMenuItem>
					<DropdownMenuItem
						data-id="ws-menu-settings"
						icon={<IconSettings size={16} aria-hidden="true" />}
						onSelect={() => navigate(WORKSPACE_SETTINGS_PATH)}
					>
						{t("workspaces.switcher.settings")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<CreateWorkspaceModal open={creating} onOpenChange={setCreating} />
		</>
	);
}

/**
 * Header control of the current workspace, behind the `workspaces` flag and
 * only on API client pages: mocks (`/projects`) have no workspaces.
 */
export function WorkspaceSwitcher() {
	const workspaces = useWorkspacesEnabled();
	const { pathname } = useLocation();
	if (!workspaces || !isWorkspaceRoute(pathname)) return null;
	return <SwitcherMenu />;
}
