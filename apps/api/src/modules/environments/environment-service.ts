import { OperationError } from "@localman/operations";
import {
	ENVIRONMENT_NAME_MAX,
	type EnvironmentColor,
	type EnvironmentDetail,
	type VariableInput,
} from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { requireEnvironment } from "./environment-access.js";
import { insertEnvironment } from "./environment-insert.js";
import {
	EnvironmentModel,
	type StoredEnvironment,
	environmentScope,
} from "./environment-model.js";
import { toEnvironmentDetail } from "./environment-view.js";
import {
	alignLocalSealing,
	assertCanSeal,
	typeChanges,
} from "./local-reseal.js";
import {
	type StoredVariable,
	secretKeysOf,
	sharedValueOf,
	toStoredVariables,
} from "./variable-store.js";

export interface NewEnvironment {
	readonly name: string;
	readonly color?: EnvironmentColor;
	readonly variables?: readonly VariableInput[];
}

export async function loadEnvironment(
	id: Types.ObjectId,
): Promise<StoredEnvironment> {
	const doc = await EnvironmentModel.findById(id).lean<StoredEnvironment>();
	if (!doc) throw elementNotFound();
	return doc;
}

/** Admins and Editors of the workspace add environments (they edit them). */
export async function createEnvironment(
	sub: string,
	workspaceId: string,
	input: NewEnvironment,
): Promise<EnvironmentDetail> {
	const { workspace } = await requireWorkspace(sub, "addElements", workspaceId);
	const id = await insertEnvironment(workspace._id, sub, (newId) => ({
		name: input.name,
		color: input.color,
		variables: toStoredVariables(
			input.variables ?? [],
			[],
			environmentScope(newId),
		),
	}));
	return toEnvironmentDetail(sub, await loadEnvironment(id), "editor");
}

export async function getEnvironment(
	sub: string,
	id: string,
): Promise<EnvironmentDetail> {
	const { environmentId, role } = await requireEnvironment(sub, id, "view");
	return toEnvironmentDetail(sub, await loadEnvironment(environmentId), role);
}

/** Editors rename or recolor it. */
export async function updateEnvironment(
	sub: string,
	id: string,
	update: { name?: string; color?: EnvironmentColor },
): Promise<EnvironmentDetail> {
	const { environmentId } = await requireEnvironment(sub, id, "edit");
	await EnvironmentModel.updateOne(
		{ _id: environmentId },
		{ $set: { ...update, updatedBy: sub } },
	);
	return toEnvironmentDetail(
		sub,
		await loadEnvironment(environmentId),
		"editor",
	);
}

export interface SetVariablesOptions {
	/** Write only if it was not changed since (409 `ENVIRONMENT_CHANGED`). */
	readonly ifUpdatedAt?: Date;
	/** Name and colour written along. */
	readonly root?: { readonly name: string; readonly color: EnvironmentColor };
}

/**
 * Editors replace the variables (definitions and shared values) in
 * order. Local values follow names, so a variable turning secret (or back)
 * reseals everyone's local values of that name, after the write.
 */
export async function setEnvironmentVariables(
	sub: string,
	id: string,
	variables: readonly VariableInput[],
	options: SetVariablesOptions = {},
): Promise<EnvironmentDetail> {
	const { environmentId } = await requireEnvironment(sub, id, "edit");
	const current = await loadEnvironment(environmentId);
	const scope = environmentScope(environmentId);
	const next = toStoredVariables(variables, current.variables, scope);
	const secrets = secretKeysOf(next);
	const types = typeChanges(secretKeysOf(current.variables), secrets);
	await assertCanSeal(scope, types.newlySecret);
	const written = await EnvironmentModel.updateOne(
		options.ifUpdatedAt
			? { _id: environmentId, updatedAt: options.ifUpdatedAt }
			: { _id: environmentId },
		{ $set: { ...options.root, variables: next, updatedBy: sub } },
	);
	if (written.matchedCount === 0) {
		throw new OperationError(
			409,
			"ENVIRONMENT_CHANGED",
			"The environment changed meanwhile; compare again and retry",
		);
	}
	await alignLocalSealing(scope, types.changed, secrets);
	return toEnvironmentDetail(
		sub,
		await loadEnvironment(environmentId),
		"editor",
	);
}

function copyName(name: string): string {
	return `${name} Copy`.slice(0, ENVIRONMENT_NAME_MAX);
}

/**
 * Copies the environment as "<name> Copy" into `workspaceId` (its own by
 * default), where the caller must be Admin or Editor. A Viewer may copy
 * it, but a secret withheld from them stays unshared in the copy.
 */
export async function duplicateEnvironment(
	sub: string,
	id: string,
	workspaceId?: string,
): Promise<EnvironmentDetail> {
	const { environmentId, element, role } = await requireEnvironment(
		sub,
		id,
		"view",
	);
	const source = await loadEnvironment(environmentId);
	const targetId = workspaceId ?? element.workspaceId.toHexString();
	const { workspace } = await requireWorkspace(sub, "addElements", targetId);
	const sourceScope = environmentScope(environmentId);
	const inputs = source.variables.map(
		(variable): VariableInput => ({
			key: variable.key,
			type: variable.type,
			enabled: variable.enabled,
			description: variable.description,
			sharedValue:
				variable.type === "secret" && role !== "editor"
					? null
					: sharedValueOf(variable, sourceScope),
		}),
	);
	const copyId = await insertEnvironment(workspace._id, sub, (newId) => ({
		name: copyName(source.name),
		color: source.color,
		variables: toStoredVariables(inputs, [], environmentScope(newId)),
	}));
	return toEnvironmentDetail(sub, await loadEnvironment(copyId), "editor");
}
