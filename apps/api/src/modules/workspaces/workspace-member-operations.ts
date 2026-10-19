import { defineOperation } from "@localman/operations";
import { WORKSPACE_ROLES } from "@localman/shared/access";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { MEMBER_ONLY, workspaceIdSchema } from "./workspace-crud-operations.js";
import { memberView } from "./workspace-member-view.js";
import {
	changeMemberRole,
	leaveWorkspace,
	listMembers,
	memberList,
	removeMemberById,
} from "./workspace-membership.js";
import { requireWorkspace } from "./workspace-roles.js";

const PATH = "/workspaces/:workspaceId/members";
const memberId = z.string().min(1).max(64);
const LAST_ADMIN =
	"409 LAST_ADMIN when the workspace would be left without an Admin.";

export const listWorkspaceMembersOperation = defineOperation({
	id: "sharing.listWorkspaceMembers",
	method: "GET",
	path: PATH,
	summary: "List the members of a workspace",
	description: `Accepted members with their role, the seats used against the owner's plan (members and invitations that can still be accepted; max null = unlimited) and, for Admins only, the pending invitations (kind account, email or link; expired ones flagged). A personal workspace has no members and \`seats: null\`. ${MEMBER_ONLY}`,
	input: z.object({ workspaceId: workspaceIdSchema }),
	output: memberList,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireWorkspace(
			sub,
			"sendRequests",
			input.workspaceId,
		);
		return listMembers(access, sub);
	},
});

export const updateWorkspaceMemberRoleOperation = defineOperation({
	id: "sharing.updateWorkspaceMemberRole",
	method: "PATCH",
	path: `${PATH}/:memberId`,
	summary: "Change a workspace member's role",
	description: `Admins only: sets the member's role to admin, editor or viewer; it applies at once. ${LAST_ADMIN} 404 NOT_FOUND for an unknown member. ${MEMBER_ONLY}`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		memberId,
		role: z.enum(WORKSPACE_ROLES),
	}),
	output: z.object({ member: memberView }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	mcpScope: "client:share",
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireWorkspace(
			sub,
			"manageRoles",
			input.workspaceId,
		);
		const member = await changeMemberRole(
			access,
			sub,
			input.memberId,
			input.role,
		);
		return { member };
	},
});

export const removeWorkspaceMemberOperation = defineOperation({
	id: "sharing.removeWorkspaceMember",
	method: "DELETE",
	path: `${PATH}/:memberId`,
	summary: "Remove a member from a team workspace",
	description: `Admins only. The person loses access at once. Pending invitations are cancelled with revoke_workspace_invitation instead. ${LAST_ADMIN} Call with dryRun to see the member first. ${MEMBER_ONLY}`,
	input: z.object({ workspaceId: workspaceIdSchema, memberId }),
	output: z.object({
		dryRun: z.boolean(),
		removed: z.boolean(),
		member: memberView,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "sharing",
	mcp: true,
	dryRun: true,
	requiresConfirmation: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireWorkspace(
			sub,
			"manageMembers",
			input.workspaceId,
		);
		const member = await removeMemberById(
			access,
			sub,
			input.memberId,
			ctx.dryRun,
		);
		return { dryRun: ctx.dryRun, removed: !ctx.dryRun, member };
	},
});

export const leaveWorkspaceOperation = defineOperation({
	id: "sharing.leaveWorkspace",
	method: "POST",
	path: "/workspaces/:workspaceId/leave",
	summary: "Leave a team workspace",
	description: `The caller stops being a member and loses access at once; rejoining needs a new invitation. A personal workspace cannot be left (409 PERSONAL_WORKSPACE). ${LAST_ADMIN} Call with dryRun to check first. ${MEMBER_ONLY}`,
	input: z.object({ workspaceId: workspaceIdSchema }),
	output: z.object({
		dryRun: z.boolean(),
		left: z.boolean(),
		member: memberView,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "sharing",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireWorkspace(sub, "joinLeave", input.workspaceId);
		const member = await leaveWorkspace(access, sub, ctx.dryRun);
		return { dryRun: ctx.dryRun, left: !ctx.dryRun, member };
	},
});

export const workspaceMemberOperations = [
	listWorkspaceMembersOperation,
	updateWorkspaceMemberRoleOperation,
	removeWorkspaceMemberOperation,
	leaveWorkspaceOperation,
] as const;
