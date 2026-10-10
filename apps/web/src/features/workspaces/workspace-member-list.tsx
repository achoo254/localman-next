import { workspaceRoleAllows } from "@localman/shared/access";
import type { WorkspaceRole } from "@localman/shared/access";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { WORKSPACES_KEY, membersKey } from "./current-workspace";
import { translatedError, workspaceErrorMessage } from "./workspace-errors";
import { invitationLabel, memberName, roleLabel } from "./workspace-labels";
import {
	WorkspaceInvitationRow,
	WorkspaceMemberRow,
} from "./workspace-member-row";
import {
	type WorkspaceMemberList as MemberList,
	type WorkspaceMember,
	removeWorkspaceMember,
	revokeWorkspaceInvitation,
	updateMemberRole,
} from "./workspace-members-api";
import type { Workspace } from "./workspaces-api";

const HEADING = "m-0 font-mono font-semibold text-[0.8125rem] text-muted";

export interface WorkspaceMemberListProps {
	workspace: Workspace;
	list: MemberList;
}

/**
 * Members (role select, remove with confirmation) and, for Admins, the
 * pending invitations (revoke at once). A refused role change, such as the
 * last Admin stepping down (`LAST_ADMIN`), shows as a toast and the select
 * goes back to the saved role.
 */
export function WorkspaceMemberList({
	workspace,
	list,
}: WorkspaceMemberListProps) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const key = membersKey(workspace.id);
	const membersHeading = useId();
	const invitesHeading = useId();
	const canManageRoles = workspaceRoleAllows(workspace.role, "manageRoles");
	const canManage = workspaceRoleAllows(workspace.role, "manageMembers");
	// Kept after closing so the dialog's text does not blank while it fades.
	const [removing, setRemoving] = useState<WorkspaceMember | null>(null);
	const [confirming, setConfirming] = useState(false);
	const fail = (error: unknown) =>
		toast.show({ tone: "error", title: workspaceErrorMessage(error, t) });

	const roleChange = useMutation({
		mutationFn: (input: { member: WorkspaceMember; role: WorkspaceRole }) =>
			updateMemberRole(workspace.id, input.member.id, input.role),
		onSuccess: (member) => {
			client.setQueryData<MemberList>(key, (current) =>
				current
					? {
							...current,
							members: current.members.map((m) =>
								m.id === member.id ? member : m,
							),
						}
					: current,
			);
			toast.show({
				tone: "success",
				title: t("workspaces.members.roleChanged", {
					name: memberName(member),
					role: roleLabel(member.role, t),
				}),
			});
		},
		onError: fail,
	});

	const revoke = useMutation({
		mutationFn: (invitationId: string) =>
			revokeWorkspaceInvitation(workspace.id, invitationId),
		onSuccess: (_result, invitationId) => {
			const invitation = list.invitations.find((i) => i.id === invitationId);
			const label = invitation ? invitationLabel(invitation, t) : "";
			toast.show({ title: t("workspaces.members.revoked", { label }) });
			void client.invalidateQueries({ queryKey: key });
		},
		onError: fail,
	});

	async function remove(member: WorkspaceMember) {
		try {
			await removeWorkspaceMember(workspace.id, member.id);
		} catch (error) {
			throw translatedError(error, t);
		}
		toast.show({
			title: t("workspaces.members.removed", { name: memberName(member) }),
		});
		await Promise.all([
			client.invalidateQueries({ queryKey: key }),
			client.invalidateQueries({ queryKey: WORKSPACES_KEY, exact: true }),
		]);
	}

	const pending = roleChange.isPending ? roleChange.variables : undefined;
	return (
		<div className="grid gap-4">
			<section className="grid gap-1" aria-labelledby={membersHeading}>
				<h2 id={membersHeading} className={HEADING}>
					{t("workspaces.members.list")}
				</h2>
				<ul className="m-0 list-none p-0">
					{list.members.map((member) => (
						<WorkspaceMemberRow
							key={member.id}
							member={member}
							role={
								pending?.member.id === member.id ? pending.role : member.role
							}
							canManageRoles={canManageRoles}
							canRemove={canManage}
							onRoleChange={(role) => roleChange.mutate({ member, role })}
							onRemove={() => {
								setRemoving(member);
								setConfirming(true);
							}}
						/>
					))}
				</ul>
			</section>
			{list.invitations.length > 0 ? (
				<section className="grid gap-1" aria-labelledby={invitesHeading}>
					<h2 id={invitesHeading} className={HEADING}>
						{t("workspaces.members.invitations")}
					</h2>
					<ul className="m-0 list-none p-0">
						{list.invitations.map((invitation) => (
							<WorkspaceInvitationRow
								key={invitation.id}
								invitation={invitation}
								busy={revoke.isPending && revoke.variables === invitation.id}
								onRevoke={() => revoke.mutate(invitation.id)}
							/>
						))}
					</ul>
				</section>
			) : null}
			<ConfirmModal
				open={confirming}
				onOpenChange={setConfirming}
				title={t("workspaces.members.removeTitle")}
				question={t("workspaces.members.removeQuestion", {
					name: removing ? memberName(removing) : "",
					workspace: workspace.name,
				})}
				confirmLabel={t("workspaces.members.removeTitle")}
				onConfirm={() => (removing ? remove(removing) : Promise.resolve())}
				data-id="ws-settings-member-remove-confirm"
			>
				<p className="m-0">{t("workspaces.members.removeText")}</p>
			</ConfirmModal>
		</div>
	);
}
