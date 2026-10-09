import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { maskEmail } from "../../lib/mask-email.js";
import { UserModel } from "../users/user-model.js";
import { acceptToken } from "./invite-acceptance.js";
import {
	INELIGIBLE_REASONS,
	expiryOf,
	ineligibility,
	inviterOf,
	resolveToken,
} from "./invite-eligibility.js";
import { takeInviteTokenSlot } from "./invite-rate-limits.js";
import { inviteTokenSchema } from "./invite-token.js";

const BROWSER_ONLY =
	"Opened by the invited person from an /invite/:token link in a browser; accepting is their own decision, not an agent's";
const TOKEN_ERRORS =
	"Token errors: 404 INVITE_NOT_FOUND (unknown, replaced, or project deleted), 410 INVITE_EXPIRED (details.expiresAt), 410 INVITE_USED, 410 INVITE_REVOKED. Rate limited per account and IP (429 RATE_LIMITED).";

export const previewInvite = defineOperation({
	id: "mock.previewInvite",
	method: "POST",
	path: "/invites/preview",
	summary: "Preview an invite or magic link",
	description: `What the token of an /invite/:token page leads to: \`kind\` (invite: one-time invitation; magic: the project's reusable magic link), the project, who invited, the expiry, the invited email masked, and whether the signed-in caller can accept (\`reason\`: NOT_INVITEE, EMAIL_NOT_VERIFIED, ALREADY_MEMBER, MEMBER_LIMIT). The token travels in the body, never in a URL. ${TOKEN_ERRORS}`,
	input: z.object({ token: inviteTokenSchema }),
	output: z.object({
		kind: z.enum(["invite", "magic"]),
		project: z.object({ id: z.string(), name: z.string() }),
		inviter: z.object({
			username: z.string(),
			name: z.string().nullable(),
			picture: z.string().nullable(),
		}),
		expiresAt: z.string().nullable(),
		inviteeEmail: z.string().nullable(),
		eligible: z.boolean(),
		reason: z.enum(INELIGIBLE_REASONS).nullable(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: { exempt: BROWSER_ONLY },
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		await takeInviteTokenSlot(sub, ctx.clientIp);
		const token = await resolveToken(input.token);
		const reason = await ineligibility(sub, token);
		const inviterSub = inviterOf(token);
		const inviter = await UserModel.findOne({ sub: inviterSub })
			.select("username name picture")
			.lean<{
				username: string;
				name?: string | null;
				picture?: string | null;
			}>();
		const email = token.kind === "invite" ? token.row.inviteeEmail : null;
		return {
			kind: token.kind,
			project: {
				id: token.project._id.toHexString(),
				name: token.project.name,
			},
			inviter: {
				username: inviter?.username ?? inviterSub,
				name: inviter?.name ?? null,
				picture: inviter?.picture ?? null,
			},
			expiresAt: expiryOf(token)?.toISOString() ?? null,
			inviteeEmail: email ? maskEmail(email) : null,
			eligible: reason === null,
			reason,
		};
	},
});

export const acceptInvite = defineOperation({
	id: "mock.acceptInvite",
	method: "POST",
	path: "/invites/accept",
	summary: "Accept an invite or magic link",
	description: `Makes the signed-in caller an accepted collaborator and returns \`projectId\` for the redirect to /projects/:id. An invitation bound to an account only admits that account; one sent to an email only an account whose IdP-verified email matches it (403 NOT_INVITEE, 403 EMAIL_NOT_VERIFIED). A magic link admits anyone signed in. 403 PLAN_LIMIT_REACHED (limit: members) when the owner's plan has no free seat. The owner and members get \`alreadyMember: true\` and nothing changes. ${TOKEN_ERRORS}`,
	input: z.object({ token: inviteTokenSchema }),
	output: z.object({ projectId: z.string(), alreadyMember: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: { exempt: BROWSER_ONLY },
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		await takeInviteTokenSlot(sub, ctx.clientIp);
		return acceptToken(sub, input.token);
	},
});

export const inviteOperations = [previewInvite, acceptInvite] as const;
