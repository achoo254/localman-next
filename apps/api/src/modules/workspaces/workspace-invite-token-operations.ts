import { defineOperation } from "@localman/operations";
import { WORKSPACE_ROLES } from "@localman/shared/access";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { maskEmail } from "../../lib/mask-email.js";
import { takeInviteTokenSlot } from "../collaborators/invite-rate-limits.js";
import { inviteTokenSchema } from "../collaborators/invite-token.js";
import { UserModel } from "../users/user-model.js";
import {
	WORKSPACE_INELIGIBLE_REASONS,
	acceptWorkspaceInvite,
	resolveWorkspaceToken,
	workspaceIneligibility,
} from "./workspace-invite-acceptance.js";
import { invitationKindOf } from "./workspace-member-view.js";

const BROWSER_ONLY =
	"Opened by the invited person from a /workspace-invite/:token link in a browser; accepting is their own decision, not an agent's";
const TOKEN_ERRORS =
	"The token travels in the body, never in a URL. Token errors: 404 INVITE_NOT_FOUND (unknown, revoked, re-issued, or workspace deleted), 410 INVITE_EXPIRED (details.expiresAt), 410 INVITE_USED (a link someone already used). Rate limited per account and IP with project invitations (429 RATE_LIMITED).";

export const previewWorkspaceInviteOperation = defineOperation({
	id: "sharing.previewWorkspaceInvite",
	method: "POST",
	path: "/workspace-invites/preview",
	summary: "Preview a workspace invitation",
	description: `What the token of a /workspace-invite/:token page leads to: the workspace, the role it grants, who invited, the expiry, the kind (account, email, link), the invited email masked, and whether the signed-in caller can accept (\`reason\`: NOT_INVITEE, EMAIL_NOT_VERIFIED, ALREADY_MEMBER, MEMBER_LIMIT). ${TOKEN_ERRORS}`,
	input: z.object({ token: inviteTokenSchema }),
	output: z.object({
		workspace: z.object({ id: z.string(), name: z.string() }),
		kind: z.enum(["account", "email", "link"]),
		role: z.enum(WORKSPACE_ROLES),
		inviter: z.object({
			username: z.string(),
			name: z.string().nullable(),
			picture: z.string().nullable(),
		}),
		expiresAt: z.string().nullable(),
		inviteeEmail: z.string().nullable(),
		eligible: z.boolean(),
		reason: z.enum(WORKSPACE_INELIGIBLE_REASONS).nullable(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: { exempt: BROWSER_ONLY },
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		await takeInviteTokenSlot(sub, ctx.clientIp);
		const token = await resolveWorkspaceToken(input.token);
		const reason = await workspaceIneligibility(sub, token);
		const { row, workspace } = token;
		const inviter = await UserModel.findOne({ sub: row.invitedBy })
			.select("username name picture")
			.lean<{
				username: string;
				name?: string | null;
				picture?: string | null;
			}>();
		return {
			workspace: { id: workspace._id.toHexString(), name: workspace.name },
			kind: invitationKindOf(row),
			role: row.role,
			inviter: {
				username: inviter?.username ?? row.invitedBy,
				name: inviter?.name ?? null,
				picture: inviter?.picture ?? null,
			},
			expiresAt: row.expiresAt?.toISOString() ?? null,
			inviteeEmail: row.email ? maskEmail(row.email) : null,
			eligible: reason === null,
			reason,
		};
	},
});

export const acceptWorkspaceInviteOperation = defineOperation({
	id: "sharing.acceptWorkspaceInvite",
	method: "POST",
	path: "/workspace-invites/accept",
	summary: "Accept a workspace invitation",
	description: `Makes the signed-in caller a member with the invitation's role and returns \`workspaceId\`. An invitation bound to an account admits only that account; one sent to an email only an account whose IdP-verified email matches it (403 NOT_INVITEE, 403 EMAIL_NOT_VERIFIED). A link admits anyone signed in, once. 403 PLAN_LIMIT_REACHED (limit: members) when the owner's plan has no free seat. Members get \`alreadyMember: true\` and nothing changes. ${TOKEN_ERRORS}`,
	input: z.object({ token: inviteTokenSchema }),
	output: z.object({ workspaceId: z.string(), alreadyMember: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: { exempt: BROWSER_ONLY },
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		await takeInviteTokenSlot(sub, ctx.clientIp);
		return acceptWorkspaceInvite(sub, input.token);
	},
});

export const workspaceInviteTokenOperations = [
	previewWorkspaceInviteOperation,
	acceptWorkspaceInviteOperation,
] as const;
