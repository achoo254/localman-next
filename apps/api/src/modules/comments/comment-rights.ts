import type { CollectionAccess } from "../collections/collection-access.js";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import type { CommentRights } from "./comment-view.js";

/**
 * The caller's rights on the comments of this collection: Editors resolve
 * anyone's thread, Admins of its workspace delete anyone's comment.
 */
export async function rightsOf(
	sub: string,
	access: CollectionAccess,
): Promise<CommentRights> {
	const workspace = await findWorkspaceById(
		access.element.workspaceId.toHexString(),
	);
	const workspaceRole = workspace
		? await workspaceRoleOf(sub, workspace)
		: null;
	return {
		sub,
		resolveAny: access.role === "editor",
		deleteAny: workspaceRole === "admin",
	};
}
