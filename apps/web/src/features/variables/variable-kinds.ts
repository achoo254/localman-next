/**
 * How a `{{name}}` reads against the scopes in use: resolved, a dynamic
 * `$name`, withheld (a secret hidden from the caller: a send using it
 * stops until they set a local value), or undeclared (no enabled scope
 * gives it a value). Also the
 * `{{` suggestions: declared names with their scope, then dynamic ones.
 */
import {
	DYNAMIC_VARIABLES,
	type ResolverLayer,
	type VariableCandidate,
	type VariableResolution,
	type VariableScopeKind,
	resolveVariable,
} from "@localman/shared/api-client";

export type VariableKind = "resolved" | "withheld" | "undeclared" | "dynamic";

/** The single place that reads the dynamic list (names keep their `$`). */
export function dynamicVariableNames(): readonly string[] {
	return DYNAMIC_VARIABLES.map((variable) => variable.name);
}

const RESOLUTIONS = new WeakMap<
	readonly ResolverLayer[],
	ReadonlyMap<string, VariableResolution>
>();

/**
 * Every declared name's resolution, computed once per layers array: each
 * name is resolved against its own entries only, so the cost grows with
 * the number of variables, not its square.
 */
export function resolutionsOf(
	layers: readonly ResolverLayer[],
): ReadonlyMap<string, VariableResolution> {
	const cached = RESOLUTIONS.get(layers);
	if (cached) return cached;
	const own = new Map<string, ResolverLayer[]>();
	for (const layer of layers) {
		for (const variable of layer.variables) {
			const entries = own.get(variable.key) ?? [];
			entries.push({ ...layer, variables: [variable] });
			own.set(variable.key, entries);
		}
	}
	const resolutions = new Map(
		[...own].map(([key, entries]) => [key, resolveVariable(key, entries)]),
	);
	RESOLUTIONS.set(layers, resolutions);
	return resolutions;
}

/** Classifies names against `layers`; build once per change of the layers. */
export function variableClassifier(
	layers: readonly ResolverLayer[],
	dynamic: readonly string[] = dynamicVariableNames(),
): (name: string) => VariableKind {
	const dynamicNames = new Set(dynamic);
	const resolutions = resolutionsOf(layers);
	return (raw) => {
		const name = raw.trim();
		if (name.startsWith("$")) {
			return dynamicNames.has(name) ? "dynamic" : "undeclared";
		}
		const winner = resolutions.get(name)?.winner;
		if (!winner) return "undeclared";
		return winner.withheld ? "withheld" : "resolved";
	};
}

export type SuggestionScope = VariableScopeKind | "dynamic";

export interface VariableSuggestion {
	name: string;
	scope: SuggestionScope;
	/** The value that wins; `null` for a dynamic variable. */
	winner: VariableCandidate | null;
}

export const SUGGESTIONS_MAX = 50;

/**
 * Names matching `query` (case-insensitive substring): names starting
 * with it first, declared before dynamic, each group by name.
 */
export function suggestionsFor(
	layers: readonly ResolverLayer[],
	query: string,
	dynamic: readonly string[] = dynamicVariableNames(),
): VariableSuggestion[] {
	const needle = query.trim().toLowerCase();
	const declared = new Map<string, VariableSuggestion>();
	for (const [key, { winner }] of resolutionsOf(layers)) {
		if (winner) declared.set(key, { name: key, scope: winner.kind, winner });
	}
	const dynamicItems = dynamic
		.filter((name) => !declared.has(name))
		.map(
			(name): VariableSuggestion => ({ name, scope: "dynamic", winner: null }),
		);
	const rank = (item: VariableSuggestion): number =>
		(item.name.toLowerCase().startsWith(needle) ? 0 : 2) +
		(item.scope === "dynamic" ? 1 : 0);
	return [...declared.values(), ...dynamicItems]
		.filter((item) => item.name.toLowerCase().includes(needle))
		.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
		.slice(0, SUGGESTIONS_MAX);
}
