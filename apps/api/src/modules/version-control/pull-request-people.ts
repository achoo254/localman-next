import { OperationError } from "@localman/operations";
import type { ElementRecord } from "../access/element-adapters.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import { UserModel } from "../users/user-model.js";
import { WorkspaceMemberModel } from "../workspaces/workspace-member-model.js";
import { findWorkspaceById } from "../workspaces/workspace-roles.js";
import { sidesOf } from "./collection-sync.js";

export interface Reviewer {
	readonly userId: string;
	readonly username: string;
	readonly name: string | null;
}

/**
 * People who hold the Editor role on the collection: its workspace's Admins
 * and Editors (the owner of a personal workspace) and those it was shared
 * with as Editor. Reviewers of its pull requests are picked among them.
 */
export async function editorsOf(element: ElementRecord): Promise<Reviewer[]> {
	const workspace = await findWorkspaceById(element.workspaceId.toHexString());
	const members =
		workspace?.type === "personal"
			? [workspace.ownerId]
			: (
					await WorkspaceMemberModel.find(
						{
							workspaceId: element.workspaceId,
							status: "accepted",
							role: { $in: ["admin", "editor"] },
						},
						{ userId: 1 },
					).lean<{ userId: string }[]>()
				).map((row) => row.userId);
	const shared = await ElementRoleModel.find(
		{
			elementType: "collection",
			elementId: element.id,
			role: "editor",
			userId: { $exists: true },
		},
		{ userId: 1 },
	).lean<{ userId: string }[]>();
	const subs = [...new Set([...members, ...shared.map((row) => row.userId)])];
	const users = await UserModel.find(
		{ sub: { $in: subs } },
		{ sub: 1, username: 1, name: 1 },
	).lean<{ sub: string; username: string; name?: string | null }[]>();
	return users.map((user) => ({
		userId: user.sub,
		username: user.username,
		name: user.name ?? null,
	}));
}

/**
 * The reviewers asked for, without duplicates or the caller; 400
 * `INVALID_REVIEWER` unless every one is an Editor of the source.
 */
export async function checkReviewers(
	source: ElementRecord,
	sub: string,
	reviewerIds: readonly string[],
): Promise<string[]> {
	const editors = new Set((await editorsOf(source)).map((user) => user.userId));
	const unique = [...new Set(reviewerIds)].filter((id) => id !== sub);
	if (unique.some((id) => !editors.has(id))) {
		throw new OperationError(
			400,
			"INVALID_REVIEWER",
			"Reviewers must be Editors of the source collection",
		);
	}
	return unique;
}

/** Who a pull request from this fork can ask to review: Editors of its source. */
export async function reviewerCandidates(
	sub: string,
	forkId: string,
): Promise<Reviewer[]> {
	const { source } = await sidesOf(sub, forkId, "edit", "view");
	return (await editorsOf(source.element)).filter(
		(user) => user.userId !== sub,
	);
}
