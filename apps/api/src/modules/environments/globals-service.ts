import { OperationError } from "@localman/operations";
import {
	type ElementRole,
	elementRoleFromWorkspace,
} from "@localman/shared/access";
import type {
	GlobalsDetail,
	LocalValue,
	LocalValuesPatch,
	VariableInput,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { WorkspaceModel } from "../workspaces/workspace-model.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import {
	GlobalVariablesModel,
	type StoredGlobals,
	globalsScope,
} from "./global-variables-model.js";
import {
	alignLocalSealing,
	assertCanSeal,
	typeChanges,
} from "./local-reseal.js";
import { patchLocalValues, readLocalValues } from "./local-values.js";
import { BROWSER_WRITER, type LocalWriter } from "./local-vault-rules.js";
import {
	secretKeysOf,
	toStoredVariables,
	toVariableViews,
} from "./variable-store.js";

interface GlobalsAccess {
	readonly workspaceId: Types.ObjectId;
	readonly role: ElementRole;
}

/**
 * Members of the workspace use its globals: Admins and Editors change
 * them, Viewers set local values only. Anyone else gets 404, so the
 * workspace's existence never leaks.
 */
async function requireGlobals(
	sub: string,
	workspaceId: string,
): Promise<GlobalsAccess> {
	const { workspace, role } = await requireWorkspace(
		sub,
		"sendRequests",
		workspaceId,
	);
	const elementRole = elementRoleFromWorkspace(role);
	if (!elementRole) {
		throw new OperationError(404, "NOT_FOUND", "Workspace not found");
	}
	return { workspaceId: workspace._id, role: elementRole };
}

async function toGlobalsDetail(
	sub: string,
	{ workspaceId, role }: GlobalsAccess,
): Promise<GlobalsDetail> {
	const stored = await GlobalVariablesModel.findOne({
		workspaceId,
	}).lean<StoredGlobals>();
	const scope = globalsScope(workspaceId);
	return {
		workspaceId: workspaceId.toHexString(),
		role,
		variables: toVariableViews(
			stored?.variables ?? [],
			scope,
			role === "editor",
		),
		localValues: await readLocalValues(sub, scope),
		updatedAt: stored?.updatedAt.toISOString() ?? null,
	};
}

export async function getGlobals(
	sub: string,
	workspaceId: string,
): Promise<GlobalsDetail> {
	return toGlobalsDetail(sub, await requireGlobals(sub, workspaceId));
}

/**
 * Admins and Editors replace the globals (definitions and shared values).
 * `keepWithheld`: an agent's write, see `toStoredVariables`.
 */
export async function setGlobals(
	sub: string,
	workspaceId: string,
	variables: readonly VariableInput[],
	keepWithheld = false,
): Promise<GlobalsDetail> {
	const access = await requireGlobals(sub, workspaceId);
	if (access.role !== "editor") {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"You are not allowed to perform this operation",
		);
	}
	const scope = globalsScope(access.workspaceId);
	const current = await GlobalVariablesModel.findOne({
		workspaceId: access.workspaceId,
	}).lean<StoredGlobals>();
	const previous = current?.variables ?? [];
	const next = toStoredVariables(variables, previous, scope, keepWithheld);
	const secrets = secretKeysOf(next);
	const types = typeChanges(secretKeysOf(previous), secrets);
	await assertCanSeal(scope, types.newlySecret);
	// Under the workspace lock, so a save racing its deletion cannot revive it.
	await inWorkspaceTransaction(access.workspaceId, (session) =>
		GlobalVariablesModel.updateOne(
			{ workspaceId: access.workspaceId },
			{ $set: { variables: next, updatedBy: sub } },
			{ upsert: true, session },
		),
	);
	await alignLocalSealing(scope, types.changed, secrets);
	return toGlobalsDetail(sub, access);
}

/** Every member sets their own local values of the globals. */
export async function patchGlobalsLocalValues(
	sub: string,
	workspaceId: string,
	patch: LocalValuesPatch,
	writer: LocalWriter = BROWSER_WRITER,
): Promise<LocalValue[]> {
	const access = await requireGlobals(sub, workspaceId);
	return patchLocalValues(
		sub,
		globalsScope(access.workspaceId),
		patch,
		async () => {
			const [workspace, stored] = await Promise.all([
				WorkspaceModel.exists({ _id: access.workspaceId }),
				GlobalVariablesModel.findOne(
					{ workspaceId: access.workspaceId },
					{ variables: 1 },
				).lean<Pick<StoredGlobals, "variables">>(),
			]);
			return {
				exists: workspace !== null,
				secretKeys: secretKeysOf(stored?.variables ?? []),
			};
		},
		writer,
	);
}
