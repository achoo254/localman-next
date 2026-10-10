import type { WorkspaceRole } from "@localman/shared/access";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { findWorkspaceById } from "../workspaces/workspace-roles.js";
import type { ElementRecord } from "./element-adapters.js";
import { ElementRoleModel } from "./element-role-model.js";

/** At most this many Editors hear about one access request. */
export const MAX_NOTIFIED_EDITORS = 50;

const EDITING_ROLES: readonly WorkspaceRole[] = ["admin", "editor"];

/**
 * Accounts that edit the element and so may approve access to it: the
 * owner of a personal workspace, the Admins and Editors of a team
 * workspace, and the people it is shared with as Editor. `except` (the
 * requester) is left out; at most `MAX_NOTIFIED_EDITORS`.
 */
export async function elementEditors(
	element: ElementRecord,
	except: string,
): Promise<string[]> {
	const editors = new Set<string>();
	const workspace = await findWorkspaceById(element.workspaceId.toHexString());
	if (workspace?.type === "personal") editors.add(workspace.ownerId);
	if (workspace?.type === "team") {
		const members = await WorkspaceMemberModel.find(
			{
				workspaceId: workspace._id,
				status: "accepted",
				role: { $in: EDITING_ROLES },
			},
			{ userId: 1 },
		)
			.sort({ _id: 1 })
			.limit(MAX_NOTIFIED_EDITORS + 1)
			.lean<{ userId?: string | null }[]>();
		for (const member of members) {
			if (member.userId) editors.add(member.userId);
		}
	}
	const shares = await ElementRoleModel.find(
		{
			elementType: element.type,
			elementId: element.id,
			role: "editor",
			userId: { $exists: true },
		},
		{ userId: 1 },
	)
		.sort({ _id: 1 })
		.limit(MAX_NOTIFIED_EDITORS + 1)
		.lean<{ userId?: string | null }[]>();
	for (const share of shares) {
		if (share.userId) editors.add(share.userId);
	}
	editors.delete(except);
	return [...editors].slice(0, MAX_NOTIFIED_EDITORS);
}
