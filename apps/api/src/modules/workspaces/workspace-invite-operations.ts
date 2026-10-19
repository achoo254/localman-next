import { defineOperation } from "@localman/operations";
import { WORKSPACE_ROLES } from "@localman/shared/access";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { usernameOrEmailSchema } from "../collaborators/invitee-lookup.js";
import { MEMBER_ONLY, workspaceIdSchema } from "./workspace-crud-operations.js";
import {
	createInviteLink,
	inviteToWorkspace,
	revokeInvitation,
} from "./workspace-invite-service.js";
import { invitationView, toInvitationView } from "./workspace-member-view.js";
import { requireWorkspace } from "./workspace-roles.js";

const role = z.enum(WORKSPACE_ROLES);
const SEATS =
	"Every accepted member and every invitation that can still be accepted takes a seat of the workspace owner's plan (Free 3, Pro 10): 403 PLAN_LIMIT_REACHED (limit: members) when none is free. A personal workspace has no members (409 PERSONAL_WORKSPACE).";
const issuedInvitation = z.object({
	invitation: invitationView,
	/** `/workspace-invite/:token`, valid 7 days; shown once, never again. */
	inviteLink: z.string(),
	notified: z.boolean(),
});

export const inviteWorkspaceMemberOperation = defineOperation({
	id: "sharing.inviteWorkspaceMember",
	method: "POST",
	path: "/workspaces/:workspaceId/invitations",
	summary: "Invite someone to a team workspace",
	description: `Admins only. Invites by username or email with a role. A matching account is bound to the invitation and notified (in-app, Web Push, Telegram as it chose); an email without an account gets a link only an account with that IdP-verified email can accept. Returns the one-time \`inviteLink\` once. Inviting the same person again issues a new link. 404 INVITEE_NOT_FOUND for an unknown username, 400 CANNOT_INVITE_SELF, 409 ALREADY_MEMBER, 429 RATE_LIMITED (shared with project invitations). ${SEATS} ${MEMBER_ONLY}`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		usernameOrEmail: usernameOrEmailSchema,
		role,
	}),
	output: issuedInvitation,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "sharing",
	mcp: true,
	mcpScope: "client:share",
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireWorkspace(
			sub,
			"manageMembers",
			input.workspaceId,
		);
		const issued = await inviteToWorkspace(
			access.workspace,
			sub,
			input.usernameOrEmail,
			input.role,
		);
		return {
			invitation: await toInvitationView(issued.row),
			inviteLink: issued.inviteLink,
			notified: issued.notified,
		};
	},
});

export const createWorkspaceInviteLinkOperation = defineOperation({
	id: "sharing.createWorkspaceInviteLink",
	method: "POST",
	path: "/workspaces/:workspaceId/invite-links",
	summary: "Create a one-use invite link to a team workspace",
	description: `Admins only. A link for no one in particular: the first signed-in person who accepts it joins with the role, then the link is used up. Returns the \`inviteLink\` once. ${SEATS} ${MEMBER_ONLY}`,
	input: z.object({ workspaceId: workspaceIdSchema, role }),
	output: issuedInvitation,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "sharing",
	mcp: true,
	mcpScope: "client:share",
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireWorkspace(
			sub,
			"manageMembers",
			input.workspaceId,
		);
		const issued = await createInviteLink(access.workspace, sub, input.role);
		return {
			invitation: await toInvitationView(issued.row),
			inviteLink: issued.inviteLink,
			notified: issued.notified,
		};
	},
});

export const revokeWorkspaceInvitationOperation = defineOperation({
	id: "sharing.revokeWorkspaceInvitation",
	method: "DELETE",
	path: "/workspaces/:workspaceId/invitations/:invitationId",
	summary: "Cancel a pending workspace invitation or invite link",
	description: `Admins only. The link stops working at once and its seat is freed. 404 NOT_FOUND for an unknown or already accepted invitation. Call with dryRun to see it first. ${MEMBER_ONLY}`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		invitationId: z.string().min(1).max(64),
	}),
	output: z.object({
		dryRun: z.boolean(),
		revoked: z.boolean(),
		invitation: invitationView,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "sharing",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireWorkspace(
			sub,
			"manageMembers",
			input.workspaceId,
		);
		const row = await revokeInvitation(
			access.workspace,
			input.invitationId,
			ctx.dryRun,
		);
		return {
			dryRun: ctx.dryRun,
			revoked: !ctx.dryRun,
			invitation: await toInvitationView(row),
		};
	},
});

export const workspaceInviteOperations = [
	inviteWorkspaceMemberOperation,
	createWorkspaceInviteLinkOperation,
	revokeWorkspaceInvitationOperation,
] as const;
