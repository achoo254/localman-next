import { defineOperation } from "@localman/operations";
import { elementRoleAllows } from "@localman/shared/access";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireElement } from "./access-policy.js";
import {
	elementAccessList,
	elementAccessView,
	elementParams,
	elementSummary,
	toElementSummary,
} from "./element-access-view.js";
import { moveElement } from "./move-service.js";

const PATH = "/elements/:elementType/:elementId";
const NO_ACCESS =
	"404 NOT_FOUND when the element does not exist or the caller holds no role on it.";

export const getElementOperation = defineOperation({
	id: "sharing.getElement",
	method: "GET",
	path: PATH,
	summary: "Open a shared collection or environment",
	description: `The element's name, workspace and the caller's role on it (the stronger of their workspace role and the role shared with them). Opening a copied link goes through here. ${NO_ACCESS}`,
	input: z.object(elementParams),
	output: elementSummary,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const { element, role } = await requireElement(
			sub,
			input.elementType,
			input.elementId,
			"view",
		);
		return toElementSummary(element, role);
	},
});

export const getElementAccessOperation = defineOperation({
	id: "sharing.getElementAccess",
	method: "GET",
	path: `${PATH}/access`,
	summary: "List who has access to a collection or environment",
	description: `"Manage access": the workspace whose members hold a role on the element (Admins and Editors edit, Viewers view) and the people it is shared with, with their role. Emails of shares to addresses without an account are shown to Editors only. ${NO_ACCESS}`,
	input: z.object(elementParams),
	output: elementAccessView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const { element, role } = await requireElement(
			sub,
			input.elementType,
			input.elementId,
			"view",
		);
		return elementAccessList(
			element,
			elementRoleAllows(element.type, role, "manageRoles"),
		);
	},
});

export const moveElementOperation = defineOperation({
	id: "sharing.moveElement",
	method: "POST",
	path: `${PATH}/move`,
	summary: "Move a collection or environment to another workspace",
	description: `Needs the Editor role on the element (or Admin/Editor of its workspace) and the right to add elements to the target workspace (403 FORBIDDEN otherwise; 404 NOT_FOUND for a workspace the caller is not in). 400 SAME_WORKSPACE when it is already there; 409 TEAM_TO_PERSONAL from a team workspace to a personal one. People it is shared with keep their role; workspace roles now come from the target workspace. ${NO_ACCESS}`,
	input: z.object({
		...elementParams,
		workspaceId: z.string().min(1).max(64),
	}),
	output: elementSummary,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) =>
		moveElement(
			requireSubject(ctx),
			input.elementType,
			input.elementId,
			input.workspaceId,
		),
});

export const elementOperations = [
	getElementOperation,
	getElementAccessOperation,
	moveElementOperation,
] as const;
