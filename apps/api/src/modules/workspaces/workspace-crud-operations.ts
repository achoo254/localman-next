import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireWorkspace } from "./workspace-roles.js";
import {
	createTeamWorkspace,
	deleteTeamWorkspace,
	listWorkspaces,
	updateWorkspaceDetails,
} from "./workspace-service.js";
import { viewOfWorkspace, workspaceView } from "./workspace-view.js";

export const workspaceIdSchema = z.string().min(1).max(64);
const nameSchema = z.string().trim().min(1).max(100);
const descriptionSchema = z.string().trim().max(1000);
const PATH = "/workspaces/:workspaceId";
export const MEMBER_ONLY =
	"404 NOT_FOUND for a workspace the caller is not a member of; 403 FORBIDDEN when their role does not allow it.";

export const listWorkspacesOperation = defineOperation({
	id: "sharing.listWorkspaces",
	method: "GET",
	path: "/workspaces",
	summary: "List the caller's workspaces",
	description:
		"The caller's personal workspace (created on first use, only they see it) first, then the team workspaces they are an accepted member of, each with the caller's role (admin, editor, viewer) and the number of members.",
	input: z.object({}),
	output: z.object({ items: z.array(workspaceView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx) => ({
		items: await listWorkspaces(requireSubject(ctx)),
	}),
});

export const createWorkspaceOperation = defineOperation({
	id: "sharing.createWorkspace",
	method: "POST",
	path: "/workspaces",
	summary: "Create a team workspace",
	description:
		"Creates a team workspace; the caller becomes its first Admin and its members count against the caller's plan. 403 PLAN_LIMIT_REACHED (limit: teamWorkspaces) when the caller already owns as many team workspaces as the plan allows (Free 1, Pro unlimited).",
	input: z.object({
		name: nameSchema,
		description: descriptionSchema.optional(),
	}),
	output: workspaceView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "sharing",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		return viewOfWorkspace(await createTeamWorkspace(sub, input), "admin");
	},
});

export const getWorkspaceOperation = defineOperation({
	id: "sharing.getWorkspace",
	method: "GET",
	path: PATH,
	summary: "Get one workspace",
	description: `Name, description, type, visibility, member count and the caller's role. ${MEMBER_ONLY}`,
	input: z.object({ workspaceId: workspaceIdSchema }),
	output: workspaceView,
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
		return viewOfWorkspace(access.workspace, access.role);
	},
});

export const updateWorkspaceOperation = defineOperation({
	id: "sharing.updateWorkspace",
	method: "PATCH",
	path: PATH,
	summary: "Edit a workspace's name or description",
	description: `Admins only. Omitted fields stay; an empty or null description clears it. ${MEMBER_ONLY}`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		name: nameSchema.optional(),
		description: descriptionSchema.nullable().optional(),
	}),
	output: workspaceView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireWorkspace(
			sub,
			"editDetails",
			input.workspaceId,
		);
		const updated = await updateWorkspaceDetails(access.workspace, input);
		return viewOfWorkspace(updated, access.role);
	},
});

export const deleteWorkspaceOperation = defineOperation({
	id: "sharing.deleteWorkspace",
	method: "DELETE",
	path: PATH,
	summary: "Delete a team workspace",
	description: `Admins only. Removes the team workspace with its members and pending invitations; everyone loses access at once. Its collections go to the trash, deleted by the caller, who can restore them into another workspace (\`collections\` counts them); its environments and globals are deleted for good (\`environments\` counts them). A personal workspace cannot be deleted (409 PERSONAL_WORKSPACE). Call with dryRun to see the workspace, its member, collection and environment counts first. ${MEMBER_ONLY}`,
	input: z.object({ workspaceId: workspaceIdSchema }),
	output: z.object({
		dryRun: z.boolean(),
		deleted: z.boolean(),
		workspace: workspaceView,
		members: z.number().int(),
		collections: z.number().int(),
		environments: z.number().int(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "sharing",
	mcp: true,
	dryRun: true,
	// Environments and globals go for good: an agent must confirm first.
	requiresConfirmation: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requireWorkspace(
			sub,
			"createDeleteWorkspace",
			input.workspaceId,
		);
		const workspace = await viewOfWorkspace(access.workspace, access.role);
		const counts = await deleteTeamWorkspace(access.workspace, ctx.dryRun, sub);
		return { dryRun: ctx.dryRun, deleted: !ctx.dryRun, workspace, ...counts };
	},
});

export const workspaceCrudOperations = [
	listWorkspacesOperation,
	createWorkspaceOperation,
	getWorkspaceOperation,
	updateWorkspaceOperation,
	deleteWorkspaceOperation,
] as const;
