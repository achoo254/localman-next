/**
 * How a `{{name}}` reads against the scopes in use: resolved, a dynamic
 * `$name`, withheld (a secret hidden from the caller: a send using it
 * stops until they set a local value), a `response "<request>" "<path>"`
 * reference to a request of the tab's collection, or undeclared (no
 * enabled scope gives it a value, or the referenced request is not
 * there). Also the `{{` suggestions: declared names with their scope,
 * then dynamic ones, then response references.
 */
import {
	DYNAMIC_VARIABLES,
	type ResolverLayer,
	type VariableCandidate,
	type VariableResolution,
	type VariableScopeKind,
	parseResponseReference,
	resolveVariable,
} from "@localman/shared/api-client";
import type { ReferenceSuggestion } from "./response-suggestions";

export type VariableKind =
	| "resolved"
	| "withheld"
	| "undeclared"
	| "dynamic"
	| "reference";

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

/**
 * Classifies names against `layers`; build once per change of the layers.
 * `requests`: names of the requests a reference may read (the tab's
 * collection); `null` outside a saved request, where references do not work.
 */
export function variableClassifier(
	layers: readonly ResolverLayer[],
	dynamic: readonly string[] = dynamicVariableNames(),
	requests: ReadonlySet<string> | null = null,
): (name: string) => VariableKind {
	const dynamicNames = new Set(dynamic);
	const resolutions = resolutionsOf(layers);
	return (raw) => {
		const name = raw.trim();
		const reference = parseResponseReference(name);
		if (reference) {
			return requests?.has(reference.requestName) ? "reference" : "undeclared";
		}
		if (name.startsWith("$")) {
			return dynamicNames.has(name) ? "dynamic" : "undeclared";
		}
		const winner = resolutions.get(name)?.winner;
		if (!winner) return "undeclared";
		return winner.withheld ? "withheld" : "resolved";
	};
}

export type SuggestionScope = VariableScopeKind | "dynamic" | "response";

export interface VariableSuggestion {
	name: string;
	scope: SuggestionScope;
	/** The value that wins; `null` for a dynamic variable or a reference. */
	winner: VariableCandidate | null;
	/** A reference's value in the last response kept, if any. */
	preview?: string;
}

export const SUGGESTIONS_MAX = 50;

/**
 * Names matching `query` (case-insensitive substring): names starting
 * with it first, declared before dynamic and response references, each
 * group by name. References also show for any start of `response`.
 */
export function suggestionsFor(
	layers: readonly ResolverLayer[],
	query: string,
	dynamic: readonly string[] = dynamicVariableNames(),
	references: readonly ReferenceSuggestion[] = [],
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
	const referenceItems = references
		.filter(
			(reference) =>
				"response".startsWith(needle) ||
				reference.expression.toLowerCase().includes(needle),
		)
		.map(
			(reference): VariableSuggestion => ({
				name: reference.expression,
				scope: "response",
				winner: null,
				...(reference.value === null ? {} : { preview: reference.value }),
			}),
		);
	const rank = (item: VariableSuggestion): number =>
		(item.name.toLowerCase().startsWith(needle) ? 0 : 2) +
		(item.scope === "dynamic" ? 1 : 0);
	const named = [...declared.values(), ...dynamicItems]
		.filter((item) => item.name.toLowerCase().includes(needle))
		.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
	// References keep the collection's order, after the names.
	return [...named, ...referenceItems].slice(0, SUGGESTIONS_MAX);
}
