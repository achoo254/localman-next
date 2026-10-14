/**
 * What a Run button imports, checked on every use: the button, its live
 * collection and, when it names one, its environment. Every failure
 * answers the same 404: unknown button, collection trashed or gone,
 * creator no longer an Admin or Editor member, public links turned off
 * (public buttons), or a caller outside the workspace (team buttons).
 */
import { OperationError } from "@localman/operations";
import { elementRoleAllows } from "@localman/shared/access";
import {
	type PublicEnvironment,
	publicEnvironment,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { elementRoleOf } from "../access/access-policy.js";
import type { StoredCollection } from "../collections/collection-model.js";
import { findLiveCollection } from "../collections/collection-store.js";
import {
	EnvironmentModel,
	type StoredEnvironment,
} from "../environments/environment-model.js";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { isCapabilityId } from "./capability-id.js";
import { canPublish, stillServable } from "./publish-access.js";
import { RunButtonModel, type StoredRunButton } from "./run-button-model.js";

export const BUTTON_ID_BYTES = 16;

export function runButtonNotFound(): OperationError {
	return new OperationError(
		404,
		"RUN_BUTTON_NOT_FOUND",
		"This Run button does not exist or was removed",
	);
}

export interface RunSource {
	readonly button: StoredRunButton;
	readonly collection: StoredCollection;
	/** `null` when the button names none or it cannot be shared any more. */
	readonly environment: PublicEnvironment | null;
	/** The button names an environment that is gone or no longer shareable. */
	readonly environmentUnavailable: boolean;
}

async function servable(
	sub: string,
	button: StoredRunButton,
	collection: StoredCollection,
): Promise<boolean> {
	if (button.visibility === "public") {
		return stillServable(button.createdBy, collection, "publicLinksAllowed");
	}
	const workspace = await findWorkspaceById(
		collection.workspaceId.toHexString(),
	);
	if (!workspace || (await workspaceRoleOf(sub, workspace)) === null) {
		return false;
	}
	return canPublish(button.createdBy, collection);
}

/**
 * The environment's public values, when it is in `workspaceId` and
 * `sharer` may still share its variables; `null` otherwise.
 */
export async function shareableEnvironment(
	environmentId: Types.ObjectId,
	workspaceId: Types.ObjectId,
	sharer: string,
): Promise<PublicEnvironment | null> {
	const env =
		await EnvironmentModel.findById(environmentId).lean<StoredEnvironment>();
	if (!env || !env.workspaceId.equals(workspaceId)) return null;
	const role = await elementRoleOf(
		sharer,
		{
			type: "environment",
			id: env._id.toHexString(),
			name: env.name,
			workspaceId: env.workspaceId,
		},
		{ claim: false },
	);
	if (!elementRoleAllows("environment", role, "shareVariables")) return null;
	return publicEnvironment({
		name: env.name,
		variables: env.variables.map((variable) => ({
			id: variable.id,
			key: variable.key,
			type: variable.type,
			enabled: variable.enabled,
			description: variable.description,
			// Secrets are sealed and dropped by `publicEnvironment` anyway.
			sharedValue:
				variable.type === "secret" || variable.sealed ? null : variable.value,
		})),
	});
}

export async function runSourceFor(
	sub: string,
	buttonId: string,
): Promise<RunSource> {
	if (!isCapabilityId(buttonId, BUTTON_ID_BYTES)) throw runButtonNotFound();
	const button = await RunButtonModel.findOne({
		buttonId,
	}).lean<StoredRunButton>();
	if (!button) throw runButtonNotFound();
	const collection = await findLiveCollection(button.collectionId);
	if (!collection || !(await servable(sub, button, collection))) {
		throw runButtonNotFound();
	}
	const environment = button.environmentId
		? await shareableEnvironment(
				button.environmentId,
				collection.workspaceId,
				button.createdBy,
			)
		: null;
	return {
		button,
		collection,
		environment,
		environmentUnavailable:
			button.environmentId !== null && environment === null,
	};
}
