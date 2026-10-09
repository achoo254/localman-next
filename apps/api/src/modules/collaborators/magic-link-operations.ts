import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import {
	getMagicLinkState,
	magicLinkState,
	revokeMagicLink,
	rotateMagicLink,
} from "./magic-link-service.js";

const projectId = z.string().min(1).max(64);
const PATH = "/projects/:projectId/magic-link";
const NOTE =
	"Owner only (403 for collaborators, 404 for projects the caller cannot read). The magic link is a reusable invite: anyone signed in who opens it joins as a collaborator while the owner's plan has a free member seat.";

export const getMagicLink = defineOperation({
	id: "collab.getMagicLink",
	method: "GET",
	path: PATH,
	summary: "Get the state of a project's magic link",
	description: `\`status\` none, active, expired or revoked, with the expiry and creation time. The link itself is shown only when created. ${NOTE}`,
	input: z.object({ projectId }),
	output: magicLinkState,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "collab",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		return getMagicLinkState(
			await requireProject(sub, "manageMembers", input.projectId),
		);
	},
});

export const rotateMagicLinkOperation = defineOperation({
	id: "collab.rotateMagicLink",
	method: "POST",
	path: PATH,
	summary: "Create a new magic link for a project",
	description: `Creates the project's magic link (\`link\`: /invite/:token, valid 7 days), replacing the previous one, which stops working at once. The link is returned only in this response. Whoever holds it can join the project as a collaborator just by signing in, so hand it only to people you trust, and never post it publicly. Members who joined keep their access. ${NOTE}`,
	input: z.object({ projectId }),
	output: magicLinkState.extend({ link: z.string() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "collab",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "manageMembers", input.projectId);
		return rotateMagicLink(project, sub);
	},
});

export const revokeMagicLinkOperation = defineOperation({
	id: "collab.revokeMagicLink",
	method: "DELETE",
	path: PATH,
	summary: "Revoke a project's magic link",
	description: `Stops the current magic link (opening it then answers 410 INVITE_REVOKED). Members who joined keep their access; create a new link to share again. ${NOTE}`,
	input: z.object({ projectId }),
	output: magicLinkState,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "collab",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		return revokeMagicLink(
			await requireProject(sub, "manageMembers", input.projectId),
		);
	},
});

export const magicLinkOperations = [
	getMagicLink,
	rotateMagicLinkOperation,
	revokeMagicLinkOperation,
] as const;
