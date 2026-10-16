import type {
	EnvironmentColor,
	MergeChange,
	MergeConflictView,
	MergePreview,
} from "@localman/shared/api-client";
import type { StoredEnvironment } from "../environments/environment-model.js";
import {
	type MergeConflict,
	type MergeOutcome,
	type MergeSide,
	mergeEntities,
	sameContent,
} from "./three-way-merge.js";

/** Key of the environment's own fields among the merged entities. */
const ROOT_KEY = "environment";

/**
 * What merges compare of an environment: name and colour, and each
 * variable by key. A secret's value is never part of it: pull and merge
 * carry keys, types and plain values, a secret keeps the value it has on
 * the receiving side.
 */
export interface EnvVariableState {
	readonly type: "default" | "secret";
	readonly enabled: boolean;
	readonly description: string;
	readonly value?: string | null;
}

export interface EnvState {
	readonly root: { readonly name: string; readonly color: EnvironmentColor };
	readonly variables: Readonly<Record<string, EnvVariableState>>;
}

export function envStateOf(env: StoredEnvironment): EnvState {
	const variables: Record<string, EnvVariableState> = {};
	for (const variable of env.variables) {
		const { type, enabled, description } = variable;
		variables[variable.key] =
			type === "secret"
				? { type, enabled, description }
				: { type, enabled, description, value: variable.value };
	}
	return { root: { name: env.name, color: env.color }, variables };
}

export interface EnvMerge {
	readonly state: EnvState;
	readonly conflicts: readonly MergeConflict[];
	readonly unresolved: readonly string[];
}

type Fields = Record<string, unknown>;

export function mergeEnvironments(
	base: EnvState,
	source: EnvState,
	destination: EnvState,
	resolutions: Readonly<Record<string, MergeSide>> = {},
): EnvMerge {
	const asFields = (state: EnvState) =>
		state.variables as unknown as Record<string, Fields>;
	const root: MergeOutcome<Fields> = mergeEntities(
		{ [ROOT_KEY]: base.root },
		{ [ROOT_KEY]: source.root },
		{ [ROOT_KEY]: destination.root },
		{ resolutions },
	);
	const variables = mergeEntities(
		asFields(base),
		asFields(source),
		asFields(destination),
		{ resolutions },
	);
	return {
		state: {
			root: (root.result[ROOT_KEY] ?? destination.root) as EnvState["root"],
			variables: variables.result as unknown as Record<
				string,
				EnvVariableState
			>,
		},
		conflicts: [...root.conflicts, ...variables.conflicts],
		unresolved: [...root.unresolved, ...variables.unresolved],
	};
}

export function envPreview(
	destination: EnvState,
	merge: EnvMerge,
): MergePreview {
	const changes: MergeChange[] = [];
	if (!sameContent(destination.root, merge.state.root)) {
		changes.push({
			kind: "changed",
			entityKind: "environment",
			name: merge.state.root.name,
		});
	}
	const keys = new Set([
		...Object.keys(destination.variables),
		...Object.keys(merge.state.variables),
	]);
	for (const key of keys) {
		const before = destination.variables[key];
		const after = merge.state.variables[key];
		if (sameContent(before, after)) continue;
		const kind = !before ? "added" : !after ? "removed" : "changed";
		changes.push({ kind, entityKind: "variable", name: key });
	}
	const conflicts: MergeConflictView[] = merge.conflicts.map((conflict) => ({
		...conflict,
		entityKind: conflict.key === ROOT_KEY ? "environment" : "variable",
		name: conflict.key === ROOT_KEY ? destination.root.name : conflict.key,
	}));
	return { changes, conflicts };
}
