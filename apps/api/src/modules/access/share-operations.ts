import { defineOperation } from "@localman/operations";
import { ELEMENT_ROLES } from "@localman/shared/access";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { usernameOrEmailSchema } from "../collaborators/invitee-lookup.js";
import { requireElement } from "./access-policy.js";
import {
	elementAccessList,
	elementAccessView,
	elementParams,
	shareView,
} from "./element-access-view.js";
import { removeShare, updateShare } from "./share-management.js";
import { shareElement } from "./share-service.js";

const PATH = "/elements/:elementType/:elementId/shares";
const MANAGER_NOTE =
	"Needs the Editor role on the element (403 FORBIDDEN for Viewers, 404 NOT_FOUND when the element does not exist or the caller holds no role on it).";
const shareId = z.string().min(1).max(64);
const role = z.enum(ELEMENT_ROLES);

export const shareElementOperation = defineOperation({
	id: "sharing.shareElement",
	method: "POST",
	path: PATH,
	summary: "Share a collection or environment with someone",
	description: `Shares by username or email as Viewer or Editor; an existing share is raised to the role, never lowered. A matching account is notified (in-app, Web Push, Telegram as it chose); an email without an account is held for the account whose IdP verifies that email. \`includeEnvironmentId\` (collections only) shares that environment too, with the same role, and needs the Editor role on it; when it is in the collection's workspace it becomes the collection's related environment until an Editor links one. Returns Manage access. 409 PERSONAL_WORKSPACE for elements of a personal workspace (move them to a team workspace first); 400 CANNOT_SHARE_SELF; 404 INVITEE_NOT_FOUND for an unknown username; lookups share a budget with invitations (429 RATE_LIMITED). ${MANAGER_NOTE}`,
	input: z.object({
		...elementParams,
		usernameOrEmail: usernameOrEmailSchema,
		role,
		includeEnvironmentId: z.string().min(1).max(64).optional(),
	}),
	output: elementAccessView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const { element } = await requireElement(
			sub,
			input.elementType,
			input.elementId,
			"manageRoles",
		);
		await shareElement(sub, element, input);
		return elementAccessList(element, true);
	},
});

export const updateElementShareOperation = defineOperation({
	id: "sharing.updateElementShare",
	method: "PATCH",
	path: `${PATH}/:shareId`,
	summary: "Change the role of a share",
	description: `Sets the role of one person's share (Manage access). It never lowers what their workspace role gives them. Returns Manage access. ${MANAGER_NOTE}`,
	input: z.object({ ...elementParams, shareId, role }),
	output: elementAccessView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const { element } = await requireElement(
			sub,
			input.elementType,
			input.elementId,
			"manageRoles",
		);
		await updateShare(element, input.shareId, input.role);
		return elementAccessList(element, true);
	},
});

export const removeElementShareOperation = defineOperation({
	id: "sharing.removeElementShare",
	method: "DELETE",
	path: `${PATH}/:shareId`,
	summary: "Stop sharing a collection or environment with someone",
	description: `Removes one share; the person keeps only what their workspace role gives them, at once. Call with dryRun to see the share first. ${MANAGER_NOTE}`,
	input: z.object({ ...elementParams, shareId }),
	output: z.object({
		dryRun: z.boolean(),
		removed: z.boolean(),
		share: shareView,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "sharing",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const { element } = await requireElement(
			sub,
			input.elementType,
			input.elementId,
			"manageRoles",
		);
		const share = await removeShare(element, input.shareId, ctx.dryRun);
		return { dryRun: ctx.dryRun, removed: !ctx.dryRun, share };
	},
});

export const shareOperations = [
	shareElementOperation,
	updateElementShareOperation,
	removeElementShareOperation,
] as const;
