import type { WorkspaceRole } from "@localman/shared/access";
import { type PlanId, limitsFor } from "@localman/shared/constants";
import type { Translate } from "../../i18n/translate";
import type {
	WorkspaceInvitation,
	WorkspaceMember,
} from "./workspace-members-api";

/** Order of the role choices: least access first, Editor is the default. */
export const ROLE_CHOICES: readonly WorkspaceRole[] = [
	"viewer",
	"editor",
	"admin",
];

export const DEFAULT_INVITE_ROLE: WorkspaceRole = "editor";

export function roleLabel(role: WorkspaceRole, t: Translate): string {
	return t(`workspaces.roles.${role}`);
}

/** Display name of a member, without the "(you)" mark. */
export function memberName(member: WorkspaceMember): string {
	return member.name || `@${member.username}`;
}

/** Who an invitation is for: the account, the address, or "Invite link". */
export function invitationLabel(
	invitation: WorkspaceInvitation,
	t: Translate,
): string {
	if (invitation.username) return `@${invitation.username}`;
	return invitation.email ?? t("workspaces.members.inviteLinkItem");
}

const PLANS: readonly PlanId[] = ["free", "pro"];

/**
 * Plan of the workspace owner, recognised by its seat cap (the API sends
 * the cap, not the plan). null when no plan has that cap.
 */
export function ownerPlanOf(max: number | null): PlanId | null {
	if (max === null) return null;
	return (
		PLANS.find((plan) => limitsFor(plan).membersPerWorkspace === max) ?? null
	);
}

/** `max` null means no cap. */
export function seatsFull(seats: {
	used: number;
	max: number | null;
}): boolean {
	return seats.max !== null && seats.used >= seats.max;
}
