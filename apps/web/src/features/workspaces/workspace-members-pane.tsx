import { workspaceRoleAllows } from "@localman/shared/access";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { membersKey } from "./current-workspace";
import { workspaceErrorMessage } from "./workspace-errors";
import { WorkspaceInviteForm } from "./workspace-invite-form";
import { seatsFull } from "./workspace-labels";
import { WorkspaceLeaveButton } from "./workspace-leave-button";
import { WorkspaceMemberList } from "./workspace-member-list";
import { fetchWorkspaceMembers } from "./workspace-members-api";
import { WorkspacePermissionsTable } from "./workspace-permissions-table";
import { WorkspaceSeats } from "./workspace-seats";
import type { Workspace } from "./workspaces-api";

function PersonalMembers({ onCreateTeam }: { onCreateTeam: () => void }) {
	const t = useT();
	return (
		<div data-id="ws-settings-members" className="grid gap-4">
			<Alert tone="info" title={t("workspaces.members.personalTitle")}>
				{t("workspaces.members.personalText")}
			</Alert>
			<Button
				variant="primary"
				data-id="ws-settings-create-team"
				className="justify-self-start"
				leadingIcon={<IconPlus size={16} aria-hidden="true" />}
				onClick={onCreateTeam}
			>
				{t("workspaces.members.createTeam")}
			</Button>
		</div>
	);
}

function MembersSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion label={t("common.loading")} className="grid gap-4">
			<Skeleton className="h-3.5 w-64 max-w-full" />
			<Skeleton className="h-11 w-full" />
			{[0, 1, 2].map((row) => (
				<div key={row} className="flex items-center gap-3">
					<Skeleton className="size-8 shrink-0" />
					<Skeleton className="h-3.5 w-40" />
				</div>
			))}
		</SkeletonRegion>
	);
}

function TeamMembers({ workspace }: { workspace: Workspace }) {
	const t = useT();
	const query = useQuery({
		queryKey: membersKey(workspace.id),
		queryFn: () => fetchWorkspaceMembers(workspace.id),
	});
	const skeleton = useDelayedFlag(query.isPending);
	if (skeleton) return <MembersSkeleton />;
	if (query.isPending) return null;
	if (query.isError) {
		return (
			<div className="grid gap-3">
				<Alert tone="danger">{workspaceErrorMessage(query.error, t)}</Alert>
				<Button
					className="justify-self-start"
					onClick={() => void query.refetch()}
				>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	}
	const list = query.data;
	const canManage = workspaceRoleAllows(workspace.role, "manageMembers");
	return (
		<div data-id="ws-settings-members" className="grid gap-6">
			{list.seats ? (
				<WorkspaceSeats seats={list.seats} canManage={canManage} />
			) : null}
			{canManage ? (
				<WorkspaceInviteForm
					workspaceId={workspace.id}
					disabled={list.seats ? seatsFull(list.seats) : false}
				/>
			) : null}
			<WorkspaceMemberList workspace={workspace} list={list} />
			<WorkspacePermissionsTable />
			<WorkspaceLeaveButton workspace={workspace} />
		</div>
	);
}

export interface WorkspaceMembersPaneProps {
	workspace: Workspace;
	onCreateTeam: () => void;
}

/** Members tab: a call to create a team workspace, or the team's members. */
export function WorkspaceMembersPane({
	workspace,
	onCreateTeam,
}: WorkspaceMembersPaneProps) {
	return workspace.type === "personal" ? (
		<PersonalMembers onCreateTeam={onCreateTeam} />
	) : (
		<TeamMembers workspace={workspace} />
	);
}
