import { OperationError } from "@localman/operations";
import {
	type ElementRole,
	elementRoleFromWorkspace,
	strongerElementRole,
} from "@localman/shared/access";
import {
	ENVIRONMENTS_PER_WORKSPACE_MAX,
	type EnvironmentSummary,
} from "@localman/shared/api-client";
import { ElementRoleModel } from "../access/element-role-model.js";
import { collectSharedElements } from "../access/shared-elements.js";
import { toObjectId } from "../collections/collection-ids.js";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { EnvironmentModel } from "./environment-model.js";
import {
	LISTED_PROJECTION,
	type ListedEnvironment,
	toEnvironmentSummary,
} from "./environment-view.js";

function workspaceNotFound(): OperationError {
	return new OperationError(404, "NOT_FOUND", "Workspace not found");
}

/**
 * The environments of the workspace `sub` may open, with their role on
 * each, by name: every one for a member, only those shared with them
 * otherwise (404 when there are none, so a workspace's existence never
 * leaks). A share can raise the workspace role, never lower it.
 */
export async function listEnvironments(
	sub: string,
	workspaceId: string,
): Promise<EnvironmentSummary[]> {
	const workspace = await findWorkspaceById(workspaceId);
	if (!workspace) throw workspaceNotFound();
	const fromWorkspace = elementRoleFromWorkspace(
		await workspaceRoleOf(sub, workspace),
	);
	const environments = fromWorkspace
		? await EnvironmentModel.find(
				{ workspaceId: workspace._id },
				LISTED_PROJECTION,
			)
				.limit(ENVIRONMENTS_PER_WORKSPACE_MAX)
				.lean<ListedEnvironment[]>()
		: await collectSharedElements(
				sub,
				"environment",
				ENVIRONMENTS_PER_WORKSPACE_MAX,
				(elementIds) =>
					EnvironmentModel.find(
						{
							_id: { $in: elementIds.flatMap((id) => toObjectId(id) ?? []) },
							workspaceId: workspace._id,
						},
						LISTED_PROJECTION,
					).lean<ListedEnvironment[]>(),
			);
	if (!fromWorkspace && environments.length === 0) throw workspaceNotFound();
	const shares = await ElementRoleModel.find(
		{
			elementType: "environment",
			elementId: { $in: environments.map((env) => env._id.toHexString()) },
			userId: sub,
		},
		{ elementId: 1, role: 1 },
	).lean<{ elementId: string; role: ElementRole }[]>();
	const shared = new Map(shares.map((row) => [row.elementId, row.role]));
	return environments
		.flatMap((env): EnvironmentSummary[] => {
			const id = env._id.toHexString();
			const role = strongerElementRole(fromWorkspace, shared.get(id) ?? null);
			return role ? [toEnvironmentSummary(env, role)] : [];
		})
		.sort(
			(a, b) =>
				a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
				(a.id < b.id ? -1 : 1),
		);
}
