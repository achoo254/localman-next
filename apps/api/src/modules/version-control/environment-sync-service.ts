import type {
	ConflictSide,
	MergeOption,
	MergePreview,
	VariableInput,
} from "@localman/shared/api-client";
import { requireEnvironment } from "../environments/environment-access.js";
import { deleteEnvironment } from "../environments/environment-delete-service.js";
import {
	type StoredEnvironment,
	environmentScope,
} from "../environments/environment-model.js";
import {
	loadEnvironment,
	setEnvironmentVariables,
	updateEnvironment,
} from "../environments/environment-service.js";
import { sharedValueOf } from "../environments/variable-store.js";
import {
	type EnvState,
	envPreview,
	envStateOf,
	mergeEnvironments,
} from "./environment-state.js";
import {
	conflictsLeft,
	requireForkPlan,
	requireLink,
	sourceUnavailable,
} from "./fork-access.js";
import { ForkModel } from "./fork-model.js";
import { sameContent } from "./three-way-merge.js";

type Resolutions = Readonly<Record<string, ConflictSide>>;

/** The fork, its link and source, and the three states to merge. */
async function sides(
	sub: string,
	forkId: string,
	forkAction: "view" | "edit",
	sourceAction: "view" | "mergeFork",
) {
	const fork = await requireEnvironment(sub, forkId, forkAction);
	await requireForkPlan(sub);
	const link = await requireLink("environment", fork.environmentId);
	const source = await requireEnvironment(
		sub,
		link.sourceId.toHexString(),
		sourceAction,
	).catch((error: unknown) => {
		throw error instanceof Error && "status" in error && error.status === 404
			? sourceUnavailable()
			: error;
	});
	const [forkEnv, sourceEnv] = await Promise.all([
		loadEnvironment(fork.environmentId),
		loadEnvironment(source.environmentId),
	]);
	return {
		fork,
		source,
		link,
		forkEnv,
		sourceEnv,
		base: link.base as EnvState,
	};
}

/**
 * Writes the merged state onto `target`: variables in the target's order,
 * new ones after; a secret keeps the value it has there (none if new).
 */
async function writeEnv(
	sub: string,
	target: StoredEnvironment,
	merged: EnvState,
): Promise<void> {
	const scope = environmentScope(target._id);
	const current = new Map(
		target.variables.map((variable) => [variable.key, variable]),
	);
	const keys = [
		...target.variables
			.map((variable) => variable.key)
			.filter((key) => key in merged.variables),
		...Object.keys(merged.variables).filter((key) => !current.has(key)),
	];
	const inputs = keys.map((key): VariableInput => {
		const next = merged.variables[key];
		const before = current.get(key);
		const type = next?.type ?? "default";
		return {
			...(before ? { id: before.id } : {}),
			key,
			type,
			enabled: next?.enabled ?? true,
			description: next?.description ?? "",
			sharedValue:
				type === "secret"
					? before?.type === "secret"
						? sharedValueOf(before, scope)
						: null
					: (next?.value ?? null),
		};
	});
	const id = target._id.toHexString();
	await setEnvironmentVariables(sub, id, inputs);
	const root = envStateOf(target).root;
	if (!sameContent(root, merged.root))
		await updateEnvironment(sub, id, merged.root);
}

export async function previewEnvironmentSync(
	sub: string,
	forkId: string,
	direction: "pull" | "merge",
): Promise<MergePreview> {
	const s = await sides(
		sub,
		forkId,
		direction === "pull" ? "edit" : "view",
		direction === "pull" ? "view" : "mergeFork",
	);
	const [from, to] =
		direction === "pull" ? [s.sourceEnv, s.forkEnv] : [s.forkEnv, s.sourceEnv];
	const destination = envStateOf(to);
	return envPreview(
		destination,
		mergeEnvironments(s.base, envStateOf(from), destination),
	);
}

/** Pulls the source's changes into the fork; the source becomes the base. */
export async function pullEnvironment(
	sub: string,
	forkId: string,
	resolutions: Resolutions,
): Promise<void> {
	const s = await sides(sub, forkId, "edit", "view");
	const merge = mergeEnvironments(
		s.base,
		envStateOf(s.sourceEnv),
		envStateOf(s.forkEnv),
		resolutions,
	);
	if (merge.unresolved.length > 0) throw conflictsLeft(merge.unresolved);
	await writeEnv(sub, s.forkEnv, merge.state);
	await ForkModel.updateOne(
		{ _id: s.link._id },
		{ $set: { base: envStateOf(s.sourceEnv) } },
	);
}

/** Merges the fork into its source; the fork becomes the base. */
export async function mergeEnvironment(
	sub: string,
	forkId: string,
	option: MergeOption,
	resolutions: Resolutions,
): Promise<void> {
	const s = await sides(
		sub,
		forkId,
		option === "merge" ? "view" : "edit",
		"mergeFork",
	);
	const merge = mergeEnvironments(
		s.base,
		envStateOf(s.forkEnv),
		envStateOf(s.sourceEnv),
		resolutions,
	);
	if (merge.unresolved.length > 0) throw conflictsLeft(merge.unresolved);
	await writeEnv(sub, s.sourceEnv, merge.state);
	await ForkModel.updateOne(
		{ _id: s.link._id },
		{ $set: { base: envStateOf(s.forkEnv) } },
	);
	if (option === "mergeAndUpdate") await pullEnvironment(sub, forkId, {});
	if (option === "mergeAndDelete") await deleteEnvironment(sub, forkId, false);
}
