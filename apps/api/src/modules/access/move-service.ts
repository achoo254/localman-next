import { OperationError } from "@localman/operations";
import {
	type ShareableElementType,
	workspaceRoleAllows,
} from "@localman/shared/access";
import {
	findWorkspaceById,
	requireWorkspace,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import {
	elementNotFound,
	elementRoleOf,
	requireElement,
} from "./access-policy.js";
import {
	type ElementSummary,
	toElementSummary,
} from "./element-access-view.js";
import { elementAdapter } from "./element-adapters.js";
import { workspaceMissing } from "./share-service.js";

/**
 * Moves an element to another workspace, as in Postman: the caller may
 * move elements out of its workspace (Admin or Editor there; a share
 * alone is not enough, or anyone it was shared with could carry the
 * team's element away) and add elements to the target workspace (a
 * workspace they are not in answers 404). Nothing moves from a team
 * workspace back to a personal one, nor out of a workspace that is gone.
 * Shares stay with the element; roles that come from the workspace are
 * derived on every check, so they follow the new workspace at once.
 */
export async function moveElement(
	sub: string,
	type: ShareableElementType,
	id: string,
	targetWorkspaceId: string,
): Promise<ElementSummary> {
	const { element } = await requireElement(sub, type, id, "view");
	const source = await findWorkspaceById(element.workspaceId.toHexString());
	if (!source) throw workspaceMissing();
	const sourceRole = await workspaceRoleOf(sub, source);
	if (!workspaceRoleAllows(sourceRole, "moveDeleteElements")) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"Only Admins and Editors of its workspace can move this element",
		);
	}
	const { workspace: target } = await requireWorkspace(
		sub,
		"addElements",
		targetWorkspaceId,
	);
	if (target._id.equals(source._id)) {
		throw new OperationError(
			400,
			"SAME_WORKSPACE",
			"The element is already in this workspace",
		);
	}
	if (source.type === "team" && target.type === "personal") {
		throw new OperationError(
			409,
			"TEAM_TO_PERSONAL",
			"Elements cannot move from a team workspace to a personal one",
		);
	}
	const adapter = elementAdapter(type);
	if (!adapter) throw elementNotFound();
	await adapter.moveTo(element.id, target._id);
	const moved = { ...element, workspaceId: target._id };
	const role = await elementRoleOf(sub, moved);
	// The mover could add elements to the target, so they keep a role on it.
	if (role === null) throw elementNotFound();
	return toElementSummary(moved, role);
}
