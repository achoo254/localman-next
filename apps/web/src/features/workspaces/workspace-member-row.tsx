import type { WorkspaceRole } from "@localman/shared/access";
import { IconLink, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Badge } from "../../components/ui/badge";
import { IconButton } from "../../components/ui/icon-button";
import { Select } from "../../components/ui/select";
import { useI18n } from "../../i18n/i18n-context";
import { PersonAvatar } from "../collaborators/person-avatar";
import {
	ROLE_CHOICES,
	invitationLabel,
	memberName,
	roleLabel,
} from "./workspace-labels";
import type {
	WorkspaceInvitation,
	WorkspaceMember,
} from "./workspace-members-api";

const ROW_CLASS =
	"flex flex-wrap items-center gap-x-3 gap-y-2 border-border-subtle border-b py-3 last:border-b-0";

function Who({ title, detail }: { title: ReactNode; detail: ReactNode }) {
	return (
		<div className="grid min-w-0 flex-1 basis-40">
			<b className="truncate text-sm">{title}</b>
			<span className="truncate text-muted text-[0.8125rem]">{detail}</span>
		</div>
	);
}

export interface WorkspaceMemberRowProps {
	member: WorkspaceMember;
	/** Role on screen: the one being saved while a change is in flight. */
	role: WorkspaceRole;
	/** The viewer may change roles (never their own). */
	canManageRoles: boolean;
	/** The viewer may remove members (never themselves: they leave). */
	canRemove: boolean;
	onRoleChange: (role: WorkspaceRole) => void;
	onRemove: () => void;
}

export function WorkspaceMemberRow({
	member,
	role,
	canManageRoles,
	canRemove,
	onRoleChange,
	onRemove,
}: WorkspaceMemberRowProps) {
	const { t } = useI18n();
	const name = memberName(member);
	return (
		<li data-id="ws-settings-member" className={ROW_CLASS}>
			<PersonAvatar name={name} picture={member.picture} />
			<Who
				title={member.isYou ? t("workspaces.members.you", { name }) : name}
				detail={`@${member.username}`}
			/>
			<Select
				aria-label={t("workspaces.members.roleOf", { name })}
				value={role}
				disabled={!canManageRoles || member.isYou}
				data-id="ws-settings-member-role"
				className="w-auto"
				onChange={(event) => {
					const next = ROLE_CHOICES.find((r) => r === event.target.value);
					if (next && next !== role) onRoleChange(next);
				}}
			>
				{ROLE_CHOICES.map((choice) => (
					<option key={choice} value={choice}>
						{roleLabel(choice, t)}
					</option>
				))}
			</Select>
			{canRemove && !member.isYou ? (
				<IconButton
					label={t("workspaces.members.remove", { name })}
					data-id="ws-settings-member-remove"
					icon={<IconX size={16} aria-hidden="true" />}
					variant="ghost"
					onClick={onRemove}
				/>
			) : null}
		</li>
	);
}

export interface WorkspaceInvitationRowProps {
	invitation: WorkspaceInvitation;
	busy: boolean;
	onRevoke: () => void;
}

/** A pending invitation: who, role, expiry, and a revoke button. */
export function WorkspaceInvitationRow({
	invitation,
	busy,
	onRevoke,
}: WorkspaceInvitationRowProps) {
	const { t, formatDate } = useI18n();
	const label = invitationLabel(invitation, t);
	const expiry = invitation.expired
		? t("workspaces.members.expired")
		: invitation.expiresAt
			? t("workspaces.members.expires", {
					date: formatDate(invitation.expiresAt),
				})
			: "";
	return (
		<li data-id="ws-settings-invite-item" className={ROW_CLASS}>
			{invitation.kind === "link" ? (
				<span
					aria-hidden="true"
					className="grid size-8 shrink-0 place-items-center rounded-sm bg-viz-grey text-on-tone"
				>
					<IconLink size={16} />
				</span>
			) : (
				<PersonAvatar name={label} picture={null} />
			)}
			<Who title={label} detail={expiry} />
			<span className="flex flex-wrap gap-1">
				{invitation.emailVerified === false ? (
					<Badge tone="warning">
						{t("workspaces.members.emailUnverified")}
					</Badge>
				) : null}
				<Badge tone="neutral">{roleLabel(invitation.role, t)}</Badge>
			</span>
			<IconButton
				label={t("workspaces.members.revoke", { label })}
				data-id="ws-settings-invite-revoke"
				icon={<IconX size={16} aria-hidden="true" />}
				variant="ghost"
				loading={busy}
				onClick={onRevoke}
			/>
		</li>
	);
}
