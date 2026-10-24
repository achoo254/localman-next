import {
	type LocalValue,
	type ProxyRequest,
	type ResolverLayer,
	type ScopeVariable,
	entryVariables,
	isVaultCiphertext,
	scopeVariables,
} from "@localman/shared/api-client";
import { requireCollection } from "../collections/collection-access.js";
import {
	CollectionModel,
	type StoredCollection,
} from "../collections/collection-model.js";
import { requireEnvironment } from "../environments/environment-access.js";
import { environmentScope } from "../environments/environment-model.js";
import { getEnvironment } from "../environments/environment-service.js";
import { globalsScope } from "../environments/global-variables-model.js";
import { getGlobals } from "../environments/globals-service.js";
import {
	readAgentCopies,
	readLocalValues,
} from "../environments/local-values.js";
import { collectionScope } from "../environments/scope-local-service.js";

/**
 * Local values as the server may use them for an agent (ADR-0009): a vault
 * ciphertext becomes its agent copy, or `locked` when the user did not let
 * agents use it.
 */
async function usableLocals(
	sub: string,
	scope: string,
	values: readonly LocalValue[],
): Promise<{ values: LocalValue[]; locked: Set<string> }> {
	const vault = values.filter((entry) => isVaultCiphertext(entry.value));
	const copies =
		vault.length > 0 ? await readAgentCopies(sub, scope) : new Map();
	const locked = new Set<string>();
	const usable = values.flatMap((entry): LocalValue[] => {
		if (!isVaultCiphertext(entry.value)) return [entry];
		const copy = copies.get(entry.key);
		if (copy === undefined) {
			locked.add(entry.key);
			return [];
		}
		return [{ key: entry.key, value: copy }];
	});
	return { values: usable, locked };
}

/** A locked vault value wins like a withheld secret: nothing stands in. */
function lockIn(
	variables: ScopeVariable[],
	locked: ReadonlySet<string>,
): ScopeVariable[] {
	const present = new Set(variables.map((variable) => variable.key));
	const lockedRows = [...locked]
		.filter((key) => !present.has(key))
		.map(
			(key): ScopeVariable => ({
				key,
				value: null,
				enabled: true,
				secret: true,
				source: "none",
				withheld: true,
			}),
		);
	return [
		...variables.map((variable) =>
			locked.has(variable.key)
				? { ...variable, value: null, source: "none" as const, withheld: true }
				: variable,
		),
		...lockedRows,
	];
}

export interface Layers {
	readonly layers: ResolverLayer[];
	/** Names locked in the vault, per layer kind. */
	readonly locked: Map<string, Set<string>>;
}

/**
 * The variable layers a send of `sub` would use (globals, collection,
 * environment), with vault values as agents may use them.
 */
export async function buildLayers(
	sub: string,
	refs: NonNullable<ProxyRequest["variables"]>,
): Promise<Layers> {
	const layers: ResolverLayer[] = [];
	const locked = new Map<string, Set<string>>();
	const add = async (
		kind: ResolverLayer["kind"],
		scope: string,
		local: readonly LocalValue[],
		build: (values: LocalValue[]) => ScopeVariable[],
	) => {
		const usable = await usableLocals(sub, scope, local);
		locked.set(kind, usable.locked);
		layers.push({
			kind,
			variables: lockIn(build(usable.values), usable.locked),
		});
	};
	const globals = await getGlobals(sub, refs.workspaceId);
	await add(
		"global",
		globalsScope(globals.workspaceId),
		globals.localValues,
		(values) => scopeVariables(globals.variables, values),
	);
	if (refs.collectionId) {
		const { collectionId } = await requireCollection(
			sub,
			refs.collectionId,
			"view",
		);
		const stored = await CollectionModel.findById(collectionId, {
			variables: 1,
		}).lean<Pick<StoredCollection, "variables">>();
		const scope = collectionScope(collectionId);
		await add(
			"collection",
			scope,
			await readLocalValues(sub, scope),
			(values) => entryVariables(stored?.variables ?? [], values),
		);
	}
	if (refs.environmentId) {
		const { environmentId } = await requireEnvironment(
			sub,
			refs.environmentId,
			"use",
		);
		const environment = await getEnvironment(sub, refs.environmentId);
		await add(
			"environment",
			environmentScope(environmentId),
			environment.localValues,
			(values) => scopeVariables(environment.variables, values),
		);
	}
	return { layers, locked };
}
