import type { WorkspaceRole } from "@localman/shared/access";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import {
	type InvitationKind,
	parseInvitationKind,
} from "./workspace-members-api";
import { parseRole } from "./workspaces-api";

/** Why the signed-in account cannot accept, as the preview says. */
export type WorkspaceIneligibleReason =
	| "NOT_INVITEE"
	| "EMAIL_NOT_VERIFIED"
	| "ALREADY_MEMBER"
	| "MEMBER_LIMIT";

const REASONS: readonly WorkspaceIneligibleReason[] = [
	"NOT_INVITEE",
	"EMAIL_NOT_VERIFIED",
	"ALREADY_MEMBER",
	"MEMBER_LIMIT",
];

export interface WorkspaceInvitePreview {
	workspace: { id: string; name: string };
	kind: InvitationKind;
	role: WorkspaceRole;
	inviter: { username: string; name: string | null; picture: string | null };
	expiresAt: string | null;
	/** Invited email, masked (`t***@example.com`); null for links. */
	inviteeEmail: string | null;
	eligible: boolean;
	reason: WorkspaceIneligibleReason | null;
}

export interface AcceptedWorkspaceInvite {
	workspaceId: string;
	alreadyMember: boolean;
}

/** The token travels in the body, never in an API URL. */
export async function previewWorkspaceInvite(
	token: string,
): Promise<WorkspaceInvitePreview> {
	const data = expectRecord(
		await apiRequest("/api/v1/workspace-invites/preview", {
			method: "POST",
			body: { token },
		}),
		"workspace invite preview",
	);
	const reason =
		data.reason === null ? null : REASONS.find((r) => r === data.reason);
	if (reason === undefined) throw new InvalidResponseError("invite reason");
	const workspace = expectRecord(data.workspace, "workspace");
	const inviter = expectRecord(data.inviter, "inviter");
	return {
		workspace: {
			id: expectString(workspace, "id"),
			name: expectString(workspace, "name"),
		},
		kind: parseInvitationKind(data.kind),
		role: parseRole(data.role, "invite role"),
		inviter: {
			username: expectString(inviter, "username"),
			name: optionalString(inviter, "name"),
			picture: optionalString(inviter, "picture"),
		},
		expiresAt: optionalString(data, "expiresAt"),
		inviteeEmail: optionalString(data, "inviteeEmail"),
		eligible: expectBoolean(data, "eligible"),
		reason,
	};
}

export async function acceptWorkspaceInvite(
	token: string,
): Promise<AcceptedWorkspaceInvite> {
	const data = expectRecord(
		await apiRequest("/api/v1/workspace-invites/accept", {
			method: "POST",
			body: { token },
		}),
		"accepted workspace invite",
	);
	return {
		workspaceId: expectString(data, "workspaceId"),
		alreadyMember: data.alreadyMember === true,
	};
}
