import type {
	EnvironmentDetail,
	ForkListItem,
	ForkStatus,
	VariableInput,
} from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import {
	type EnvironmentAccess,
	requireEnvironment,
} from "../environments/environment-access.js";
import { insertEnvironmentIn } from "../environments/environment-insert.js";
import { environmentScope } from "../environments/environment-model.js";
import {
	getEnvironment,
	loadEnvironment,
} from "../environments/environment-service.js";
import {
	sharedValueOf,
	toStoredVariables,
} from "../environments/variable-store.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { envStateOf } from "./environment-state.js";
import { requireForkPlan, requireForkTarget } from "./fork-access.js";
import { forkStatusOf, forksOf } from "./fork-listing.js";
import { ForkModel } from "./fork-model.js";

/** An environment the caller may fork into a workspace: access and target. */
export interface EnvironmentForkPlan {
	readonly access: EnvironmentAccess;
	readonly workspace: Awaited<ReturnType<typeof requireForkTarget>>;
}

/**
 * Checks that the caller may fork the environment into `workspaceId`:
 * fork access on it, then the target for that role (a Viewer forks into
 * their personal workspace only). Plan and rate limit are the caller's.
 */
export async function planEnvironmentFork(
	sub: string,
	id: string,
	workspaceId: string,
): Promise<EnvironmentForkPlan> {
	const access = await requireEnvironment(sub, id, "fork");
	const workspace = await requireForkTarget(sub, access.role, workspaceId);
	return { access, workspace };
}

/** Writes one prepared environment fork inside a transaction on its target. */
export type EnvironmentForkWrite = (
	session: ClientSession,
) => Promise<Types.ObjectId>;

/**
 * Reads a checked environment and returns the write of its fork under the
 * same name: its variables with new ids, a secret's value only for an
 * Editor of the source (as a copy), and a link whose base is the source as
 * copied. Reading first keeps the writing transaction short.
 */
export async function prepareEnvironmentFork(
	sub: string,
	{ access, workspace }: EnvironmentForkPlan,
	label: string,
): Promise<EnvironmentForkWrite> {
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
	return (session) =>
		insertEnvironmentIn(
			session,
			workspace._id,
			sub,
			(newId) => ({
				name: source.name,
				color: source.color,
				variables: toStoredVariables(inputs, [], environmentScope(newId)),
			}),
			async (newId) => {
				await ForkModel.create(
					[
						{
							kind: "environment",
							sourceId: access.environmentId,
							forkId: newId,
							label,
							createdBy: sub,
							base: envStateOf(source),
						},
					],
					{ session },
				);
			},
		);
}

/** Forks an environment (Pro); see `prepareEnvironmentFork`. */
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
	const write = await prepareEnvironmentFork(
		sub,
		{ access, workspace },
		input.label,
	);
	const forkId = await inWorkspaceTransaction(workspace._id, write);
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
