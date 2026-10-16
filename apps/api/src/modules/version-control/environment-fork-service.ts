import type {
	EnvironmentDetail,
	ForkListItem,
	ForkStatus,
	VariableInput,
} from "@localman/shared/api-client";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import { requireEnvironment } from "../environments/environment-access.js";
import { environmentScope } from "../environments/environment-model.js";
import {
	getEnvironment,
	insertEnvironment,
	loadEnvironment,
} from "../environments/environment-service.js";
import {
	sharedValueOf,
	toStoredVariables,
} from "../environments/variable-store.js";
import { envStateOf } from "./environment-state.js";
import { requireForkPlan, requireForkTarget } from "./fork-access.js";
import { forkStatusOf, forksOf } from "./fork-listing.js";
import { ForkModel } from "./fork-model.js";

/**
 * Forks an environment (Pro) under the same name: its variables with new
 * ids, a secret's value only for an Editor of the source (as a copy), and
 * a link whose base is the source as copied.
 */
export async function forkEnvironment(
	sub: string,
	id: string,
	input: { label: string; workspaceId: string },
): Promise<EnvironmentDetail> {
	const access = await requireEnvironment(sub, id, "fork");
	await requireForkPlan(sub);
	await takeOperationSlot("fork", sub, access.element.id);
	const workspace = await requireForkTarget(
		sub,
		access.role,
		input.workspaceId,
	);
	const source = await loadEnvironment(access.environmentId);
	const scope = environmentScope(access.environmentId);
	const inputs = source.variables.map(
		(variable): VariableInput => ({
			key: variable.key,
			type: variable.type,
			enabled: variable.enabled,
			description: variable.description,
			sharedValue:
				variable.type === "secret" && access.role !== "editor"
					? null
					: sharedValueOf(variable, scope),
		}),
	);
	const forkId = await insertEnvironment(
		workspace._id,
		sub,
		(newId) => ({
			name: source.name,
			color: source.color,
			variables: toStoredVariables(inputs, [], environmentScope(newId)),
		}),
		async (newId, session) => {
			await ForkModel.create(
				[
					{
						kind: "environment",
						sourceId: access.environmentId,
						forkId: newId,
						label: input.label,
						createdBy: sub,
						base: envStateOf(source),
					},
				],
				{ session },
			);
		},
	);
	return getEnvironment(sub, forkId.toHexString());
}

export async function environmentForkStatus(
	sub: string,
	id: string,
): Promise<ForkStatus> {
	const { environmentId } = await requireEnvironment(sub, id, "view");
	return forkStatusOf(sub, "environment", environmentId);
}

export async function listEnvironmentForks(
	sub: string,
	id: string,
): Promise<ForkListItem[]> {
	const { environmentId } = await requireEnvironment(sub, id, "view");
	return forksOf(sub, "environment", environmentId);
}
