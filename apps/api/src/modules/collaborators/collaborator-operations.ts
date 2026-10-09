import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import "./collaborator-dependent.js";
import {
	collaboratorList,
	listCollaborators,
	removeCollaborator,
} from "./collaborator-service.js";
import { collaboratorView, toCollaboratorView } from "./collaborator-view.js";
import { inviteCollaborator } from "./invite-service.js";
import {
	assertInvitable,
	resolveInviteTarget,
	takeInviteLookupSlot,
	usernameOrEmailSchema,
} from "./invitee-lookup.js";
import { inviteeView, toInviteeView } from "./invitee-view.js";

const projectId = z.string().min(1).max(64);
const PATH = "/projects/:projectId/collaborators";
const OWNER_NOTE =
	"Owner only (403 for collaborators, 404 for projects the caller cannot read). Lookups and invitations share a budget per owner (429 RATE_LIMITED). The owner (400 CANNOT_INVITE_SELF) and existing members (409 ALREADY_MEMBER) are refused without account details.";

export const listCollaboratorsOperation = defineOperation({
	id: "mock.listCollaborators",
	method: "GET",
	path: PATH,
	summary: "List the members of a mock project",
	description:
		"The owner, member seats used against the owner's plan (owner, accepted members and pending invitations; max null = unlimited) and the rows. The owner sees pending and expired invitations with the invited email; a collaborator sees only accepted members.",
	input: z.object({ projectId }),
	output: collaboratorList,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "read", input.projectId);
		return listCollaborators(project, sub);
	},
});

export const lookupInviteeOperation = defineOperation({
	id: "mock.lookupInvitee",
	method: "POST",
	path: `${PATH}/lookup`,
	summary: "Find the account an invitation would go to",
	description: `Exact, case-insensitive match of a username (\`@\` allowed) or an email, never a prefix. Returns the matching account's username, name, avatar, masked email and whether the IdP verified its email (\`match: null\` when nothing matches). ${OWNER_NOTE}`,
	input: z.object({ projectId, usernameOrEmail: usernameOrEmailSchema }),
	output: z.object({ match: inviteeView.nullable() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "manageMembers", input.projectId);
		await takeInviteLookupSlot(sub);
		const target = await resolveInviteTarget(input.usernameOrEmail);
		if (!target) return { match: null };
		await assertInvitable(project, target);
		return {
			match: target.kind === "account" ? toInviteeView(target.account) : null,
		};
	},
});

export const inviteCollaboratorOperation = defineOperation({
	id: "mock.inviteCollaborator",
	method: "POST",
	path: PATH,
	summary: "Invite someone to a mock project",
	description: `Invites by username or email. A matching account is bound to the invitation and notified (in-app, Web Push, Telegram as it chose); an email without an account gets a link only an account with that IdP-verified email can accept. Returns the one-time \`inviteLink\` (\`/invite/:token\`, valid 7 days) once: it is never shown again. Inviting the same person again issues a new link. 404 INVITEE_NOT_FOUND for an unknown username; 403 PLAN_LIMIT_REACHED (limit: members) when the owner's plan has no free seat. ${OWNER_NOTE}`,
	input: z.object({ projectId, usernameOrEmail: usernameOrEmailSchema }),
	output: z.object({
		collaborator: collaboratorView,
		inviteLink: z.string(),
		invitee: inviteeView.nullable(),
		notified: z.boolean(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "mock",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "manageMembers", input.projectId);
		const issued = await inviteCollaborator(
			project,
			sub,
			input.usernameOrEmail,
		);
		return {
			collaborator: await toCollaboratorView(issued.row, { showEmails: true }),
			inviteLink: issued.inviteLink,
			invitee:
				issued.target.kind === "account"
					? toInviteeView(issued.target.account)
					: null,
			notified: issued.notified,
		};
	},
});

export const removeCollaboratorOperation = defineOperation({
	id: "mock.removeCollaborator",
	method: "DELETE",
	path: `${PATH}/:collaboratorId`,
	summary: "Remove a member, cancel an invitation or leave a project",
	description:
		"The owner removes any member or invitation; a collaborator may remove only their own membership (leave the project). The person loses access at once. Call with dryRun to see the row first.",
	input: z.object({ projectId, collaboratorId: z.string().min(1).max(64) }),
	output: z.object({
		dryRun: z.boolean(),
		removed: z.boolean(),
		collaborator: collaboratorView,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "read", input.projectId);
		const collaborator = await removeCollaborator(
			project,
			sub,
			input.collaboratorId,
			ctx.dryRun,
		);
		return { dryRun: ctx.dryRun, removed: !ctx.dryRun, collaborator };
	},
});

export const collaboratorOperations = [
	listCollaboratorsOperation,
	lookupInviteeOperation,
	inviteCollaboratorOperation,
	removeCollaboratorOperation,
] as const;
