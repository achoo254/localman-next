/**
 * The Admin's switches of public sharing, apart from
 * `sharing.updateWorkspace`: turning one off is destructive (links, keys
 * and buttons stop at once) and an operation's annotations cannot depend
 * on its input.
 */
import { defineOperation } from "@localman/operations";
import type { WorkspaceSharingSettings } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	MEMBER_ONLY,
	workspaceIdSchema,
} from "../workspaces/workspace-crud-operations.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import {
	sharingSettingsOf,
	updateWorkspaceSharing,
} from "./workspace-sharing.js";

const PATH = "/workspaces/:workspaceId/sharing";

const sharingView = z.object({
	publicLinksAllowed: z.boolean(),
	guestsAllowed: z.boolean(),
	accessKeysAllowed: z.boolean(),
});

export const getWorkspaceSharingOperation = defineOperation({
	id: "sharing.getWorkspaceSharing",
	method: "GET",
	path: PATH,
	summary: "Get a workspace's public sharing switches",
	description: `Whether public links (and public Run buttons), guest links and access keys may be used for its collections; all on unless an Admin turned one off. ${MEMBER_ONLY}`,
	input: z.object({ workspaceId: workspaceIdSchema }),
	output: sharingView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, { workspaceId }) => {
		const sub = requireSubject(ctx);
		const { workspace } = await requireWorkspace(
			sub,
			"sendRequests",
			workspaceId,
		);
		return sharingSettingsOf(workspace);
	},
});

export const updateWorkspaceSharingOperation = defineOperation({
	id: "sharing.updateWorkspaceSharing",
	method: "PATCH",
	path: PATH,
	summary: "Turn a workspace's public sharing switches on or off",
	description: `Admins only. Omitted switches stay. Turning one off stops at once what it covers (\`stopped\` counts them; nothing is deleted, turning it back on resumes them): public links and public Run buttons, guest links, access keys. Call with dryRun to see the counts first. ${MEMBER_ONLY}`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		publicLinksAllowed: z.boolean().optional(),
		guestsAllowed: z.boolean().optional(),
		accessKeysAllowed: z.boolean().optional(),
	}),
	output: z.object({
		dryRun: z.boolean(),
		sharing: sharingView,
		stopped: z.object({
			links: z.number().int(),
			accessKeys: z.number().int(),
			runButtons: z.number().int(),
		}),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "sharing",
	mcp: true,
	mcpScope: "client:share",
	dryRun: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const { workspace } = await requireWorkspace(
			sub,
			"manageVisibility",
			input.workspaceId,
		);
		const patch: Partial<WorkspaceSharingSettings> = {};
		if (input.publicLinksAllowed !== undefined) {
			patch.publicLinksAllowed = input.publicLinksAllowed;
		}
		if (input.guestsAllowed !== undefined) {
			patch.guestsAllowed = input.guestsAllowed;
		}
		if (input.accessKeysAllowed !== undefined) {
			patch.accessKeysAllowed = input.accessKeysAllowed;
		}
		return updateWorkspaceSharing(workspace, patch, ctx.dryRun);
	},
});
