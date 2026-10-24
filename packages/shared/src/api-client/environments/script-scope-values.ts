/**
 * What a script sees of each variable scope, and what it changed. Scripts
 * read the values a send would use (local first, enabled only, never a
 * withheld secret) and write the caller's **local** values, as Postman's
 * `pm.environment.set` changes the current value: a set becomes a local
 * value, an unset or clear resets the name to its shared value.
 */
import type { ResolverLayer } from "./variable-resolver.js";

/** The scopes `lm.globals`, `lm.collectionVariables`, `lm.environment` show. */
export interface ScriptScopeValues {
	globals: Record<string, string>;
	collectionVariables: Record<string, string>;
	environment: Record<string, string>;
}

export type ScriptScopeName = keyof ScriptScopeValues;

/**
 * A local value to set, or `value: null` to reset it to the shared one.
 * `agentValue`: see `localValuesPatchSchema`.
 */
export interface LocalValueWrite {
	key: string;
	value: string | null;
	agentValue?: string | null;
}

export type ScriptScopeChanges = Record<ScriptScopeName, LocalValueWrite[]>;

const SCOPE_OF = {
	global: "globals",
	collection: "collectionVariables",
	environment: "environment",
} as const satisfies Partial<Record<ResolverLayer["kind"], ScriptScopeName>>;

/** A record with no prototype, so a variable named "__proto__" stays data. */
function bare(): Record<string, string> {
	return Object.create(null);
}

export function emptyScriptScopes(): ScriptScopeValues {
	return { globals: bare(), collectionVariables: bare(), environment: bare() };
}

/** Each scope's usable values, from the layers a send resolves. */
export function scriptScopeValues(
	layers: readonly ResolverLayer[],
): ScriptScopeValues {
	const values = emptyScriptScopes();
	for (const layer of layers) {
		if (layer.kind === "temporary") continue;
		const target = values[SCOPE_OF[layer.kind]];
		for (const variable of layer.variables) {
			if (!variable.enabled || variable.withheld) continue;
			if (variable.value === null) continue;
			target[variable.key] = variable.value;
		}
	}
	return values;
}

/**
 * The layers with what the scripts left: a value set by a script wins in
 * its scope for this send, a value it unset or cleared is gone from it
 * (a lower scope may fill the name in), as in Postman.
 */
export function withScriptScopes(
	layers: readonly ResolverLayer[],
	scopes: ScriptScopeValues,
): ResolverLayer[] {
	return layers.map((layer) => {
		if (layer.kind === "temporary") return layer;
		const values = scopes[SCOPE_OF[layer.kind]];
		const seen = new Set<string>();
		const variables = layer.variables.flatMap((variable) => {
			const usable =
				variable.enabled && !variable.withheld && variable.value !== null;
			if (!Object.hasOwn(values, variable.key)) return usable ? [] : [variable];
			seen.add(variable.key);
			const value = values[variable.key] ?? null;
			return [
				{ ...variable, value, source: "local" as const, withheld: false },
			];
		});
		const added = Object.entries(values)
			.filter(([key]) => !seen.has(key))
			.map(([key, value]) => ({
				key,
				value,
				enabled: true,
				secret: false,
				source: "local" as const,
				withheld: false,
			}));
		return { ...layer, variables: [...variables, ...added] };
	});
}

function changesOf(
	before: Readonly<Record<string, string>>,
	after: Readonly<Record<string, string>>,
): LocalValueWrite[] {
	const writes: LocalValueWrite[] = [];
	for (const [key, value] of Object.entries(after)) {
		if (before[key] !== value) writes.push({ key, value });
	}
	for (const key of Object.keys(before)) {
		if (!Object.hasOwn(after, key)) writes.push({ key, value: null });
	}
	return writes;
}

/** The local value writes that turn `before` into what the scripts left. */
export function scriptScopeChanges(
	before: ScriptScopeValues,
	after: ScriptScopeValues,
): ScriptScopeChanges {
	return {
		globals: changesOf(before.globals, after.globals),
		collectionVariables: changesOf(
			before.collectionVariables,
			after.collectionVariables,
		),
		environment: changesOf(before.environment, after.environment),
	};
}

export function hasScriptScopeChanges(changes: ScriptScopeChanges): boolean {
	return (
		changes.globals.length > 0 ||
		changes.collectionVariables.length > 0 ||
		changes.environment.length > 0
	);
}
