import { OperationError } from "@localman/operations";
import { workspaceRoleAllows } from "@localman/shared/access";
import type { ClientSession, Types } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import { AccessRequestModel } from "../access/access-request-model.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import { RunButtonModel } from "../public-sharing/run-button-model.js";
import { ForkModel } from "../version-control/fork-model.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { ActiveEnvironmentModel } from "./active-environment-model.js";
import { requireEnvironment } from "./environment-access.js";
import { EnvironmentModel, environmentScope } from "./environment-model.js";
import {
	GlobalVariablesModel,
	globalsScope,
} from "./global-variables-model.js";
import { deleteScopeLocalValues } from "./local-values.js";

export interface EnvironmentDeletion {
	readonly dryRun: boolean;
	readonly deleted: boolean;
	readonly environmentId: string;
	readonly name: string;
	readonly variables: number;
}

/**
 * Everything that hangs off these environments: shares, requests,
 * choices, and the Run buttons that would import them.
 */
async function deleteDependents(
	ids: readonly Types.ObjectId[],
	session: ClientSession,
): Promise<void> {
	if (ids.length === 0) return;
	const elementIds = ids.map((id) => id.toHexString());
	const elements = {
		elementType: "environment" as const,
		elementId: { $in: elementIds },
	};
	await ActiveEnvironmentModel.deleteMany(
		{ environmentId: { $in: ids } },
		{ session },
	);
	await ElementRoleModel.deleteMany(elements, { session });
	await AccessRequestModel.deleteMany(elements, { session });
	await RunButtonModel.deleteMany({ environmentId: { $in: ids } }, { session });
	// A deleted fork drops its link; a deleted source keeps its forks' links.
	await ForkModel.deleteMany(
		{ kind: "environment", forkId: { $in: ids } },
		{ session },
	);
	await deleteScopeLocalValues(ids.map(environmentScope), session);
}

/**
 * Deletes the environment for good, with its variables, everyone's local
 * values, shares and access requests. Needs the Editor role on it and
 * Admin or Editor in its workspace (a share alone is not enough), as for
 * collections. The dry run names it and counts its variables.
 */
export async function deleteEnvironment(
	sub: string,
	id: string,
	dryRun: boolean,
): Promise<EnvironmentDeletion> {
	const { element, environmentId } = await requireEnvironment(sub, id, "edit");
	const workspace = await findWorkspaceById(element.workspaceId.toHexString());
	const workspaceRole = workspace
		? await workspaceRoleOf(sub, workspace)
		: null;
	if (!workspaceRoleAllows(workspaceRole, "moveDeleteElements")) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"Only Admins and Editors of its workspace can delete this environment",
		);
	}
	const doc = await EnvironmentModel.findById(environmentId, {
		name: 1,
		variableCount: { $size: "$variables" },
	}).lean<{ name: string; variableCount: number }>();
	if (!doc) throw elementNotFound();
	const summary = {
		environmentId: environmentId.toHexString(),
		name: doc.name,
		variables: doc.variableCount,
	};
	if (dryRun) return { dryRun, deleted: false, ...summary };
	const deleted = await inWorkspaceTransaction(
		element.workspaceId,
		async (session) => {
			const result = await EnvironmentModel.deleteOne(
				{ _id: environmentId },
				{ session },
			);
			if (result.deletedCount === 0) return false;
			await deleteDependents([environmentId], session);
			return true;
		},
	);
	if (!deleted) throw elementNotFound();
	return { dryRun, deleted, ...summary };
}

/** How many environments the workspace holds (its deletion dry run). */
export function countWorkspaceEnvironments(
	workspaceId: Types.ObjectId,
): Promise<number> {
	return EnvironmentModel.countDocuments({ workspaceId });
}

/**
 * Removes the workspace's environments and globals with everything that
 * hangs off them, inside the workspace deletion's transaction.
 */
export async function deleteWorkspaceEnvironments(
	workspaceId: Types.ObjectId,
	session: ClientSession,
): Promise<number> {
	const ids = (
		await EnvironmentModel.find({ workspaceId }, { _id: 1 })
			.session(session)
			.lean<{ _id: Types.ObjectId }[]>()
	).map((doc) => doc._id);
	await EnvironmentModel.deleteMany({ workspaceId }, { session });
	await deleteDependents(ids, session);
	await GlobalVariablesModel.deleteOne({ workspaceId }, { session });
	await ActiveEnvironmentModel.deleteMany({ workspaceId }, { session });
	await deleteScopeLocalValues([globalsScope(workspaceId)], session);
	return ids.length;
}
