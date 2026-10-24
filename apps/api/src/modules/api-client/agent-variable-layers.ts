import {
	type LocalValue,
	type ProxyRequest,
	type ResolverLayer,
	type ScopeVariable,
	type VariableView,
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

interface UsableLocals {
	readonly values: LocalValue[];
	readonly locked: Set<string>;
	/** Agent copies filled in: masked whatever the variable's type now. */
	readonly copies: string[];
	/** Names whose value is an agent copy. */
	readonly copied: Set<string>;
}

/**
 * Local values as the server may use them for an agent (ADR-0009). A
 * person's own value of a secret (`vaultKeys`, or any vault ciphertext) is
 * used only through the copy they let agents use, else `locked`: that
 * covers values saved before the vault, too. A copy stays a secret even if
 * its variable stopped being one or lost its definition.
 */
async function usableLocals(
	sub: string,
	scope: string,
	values: readonly LocalValue[],
	vaultKeys: ReadonlySet<string>,
): Promise<UsableLocals> {
	const owned = (entry: LocalValue) =>
		vaultKeys.has(entry.key) || isVaultCiphertext(entry.value);
	const copies = values.some(owned)
		? await readAgentCopies(sub, scope)
		: new Map<string, string>();
	const locked = new Set<string>();
	const used: string[] = [];
	const copied = new Set<string>();
	const usable = values.flatMap((entry): LocalValue[] => {
		if (!owned(entry)) return [entry];
		const copy = copies.get(entry.key);
		if (copy === undefined) {
			locked.add(entry.key);
			return [];
		}
		used.push(copy);
		copied.add(entry.key);
		return [{ key: entry.key, value: copy }];
	});
	return { values: usable, locked, copies: used, copied };
}

const secretNames = (variables: readonly VariableView[]): Set<string> =>
	new Set(
		variables
			.filter((variable) => variable.type === "secret")
			.map((variable) => variable.key),
	);

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
	/** Agent copies in use, always masked. */
	readonly copies: string[];
	/** Names backed by an agent copy, per layer kind. */
	readonly copied: Map<string, Set<string>>;
	/** The stored scope of each layer kind (`environment:<id>`...). */
	readonly scopes: Map<string, string>;
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
	const copies: string[] = [];
	const copied = new Map<string, Set<string>>();
	const scopes = new Map<string, string>();
	const add = async (
		kind: ResolverLayer["kind"],
		scope: string,
		local: readonly LocalValue[],
		vaultKeys: ReadonlySet<string>,
		build: (values: LocalValue[]) => ScopeVariable[],
	) => {
		const usable = await usableLocals(sub, scope, local, vaultKeys);
		locked.set(kind, usable.locked);
		copies.push(...usable.copies);
		copied.set(kind, usable.copied);
		scopes.set(kind, scope);
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
		secretNames(globals.variables),
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
		const entries = stored?.variables ?? [];
		await add(
			"collection",
			scope,
			await readLocalValues(sub, scope),
			new Set(
				entries.filter((entry) => entry.secret).map((entry) => entry.key),
			),
			(values) => entryVariables(entries, values),
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
			secretNames(environment.variables),
			(values) => scopeVariables(environment.variables, values),
		);
	}
	return { layers, locked, copies, copied, scopes };
}
