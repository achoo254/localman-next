/**
 * Which value a `{{name}}` takes, and why. Scopes go from lowest to
 * highest precedence (globals, collection, environment, temporary); in
 * each, a person's local value overrides the shared one. The answer names
 * the winning scope and every value it overrides, for the hover card that
 * strikes through overridden values.
 */
import type { VariableEntry } from "../variable-interpolation.js";
import type {
	LocalValue,
	VariableScopeKind,
	VariableView,
} from "./environment-model.js";

/** One variable of a scope, with the value the caller would use. */
export interface ScopeVariable {
	key: string;
	/** `null`: nothing to fill in (unshared and no local value, or withheld). */
	value: string | null;
	enabled: boolean;
	secret: boolean;
	source: "local" | "shared" | "none";
	/** A secret whose shared value is hidden from the caller (no local value). */
	withheld: boolean;
	/** Withheld because the caller's own value is locked in the vault. */
	locked?: boolean;
	/** Locked for good: sealed by another vault, unlocking does not help. */
	unreadable?: boolean;
}

export interface ResolverLayer {
	kind: VariableScopeKind;
	/** The environment's or collection's name, for the hover card. */
	label?: string;
	variables: readonly ScopeVariable[];
}

export interface VariableCandidate extends ScopeVariable {
	kind: VariableScopeKind;
	label?: string;
}

export interface VariableResolution {
	/** The value used; `null` when no enabled scope declares the name. */
	winner: VariableCandidate | null;
	/** Lower enabled values the winner overrides, then disabled ones. */
	overridden: VariableCandidate[];
}

/** A variable whose own value (`entry`) is locked in the vault. */
function lockedVariable(entry: LocalValue, secret: boolean): ScopeVariable {
	return {
		key: entry.key,
		value: null,
		enabled: true,
		secret,
		source: "none",
		withheld: true,
		locked: true,
		...(entry.unreadable ? { unreadable: true } : {}),
	};
}

/**
 * A scope's variables with the caller's local values applied. A local
 * value without a definition (set by a script) counts as a plain variable
 * of the scope.
 */
export function scopeVariables(
	variables: readonly VariableView[],
	localValues: readonly LocalValue[],
): ScopeVariable[] {
	const local = new Map(localValues.map((entry) => [entry.key, entry.value]));
	const locked = new Map(
		localValues.filter((entry) => entry.locked).map((e) => [e.key, e]),
	);
	const defined = variables.map((variable): ScopeVariable => {
		const own = local.get(variable.key);
		const secret = variable.type === "secret";
		const lockedEntry = locked.get(variable.key);
		if (lockedEntry) {
			// The caller's own value wins but cannot be read now: nothing
			// stands in for it, as for a withheld secret.
			return {
				...lockedVariable(lockedEntry, secret),
				enabled: variable.enabled,
			};
		}
		if (own !== undefined) {
			const base = { key: variable.key, enabled: variable.enabled, secret };
			return { ...base, value: own, source: "local", withheld: false };
		}
		return {
			key: variable.key,
			value: variable.sharedValue,
			enabled: variable.enabled,
			secret,
			source: variable.sharedValue === null ? "none" : "shared",
			withheld: variable.sharedHidden,
		};
	});
	const names = new Set(variables.map((variable) => variable.key));
	const extra = localValues
		.filter((entry) => !names.has(entry.key))
		.map(
			(entry): ScopeVariable =>
				entry.locked
					? lockedVariable(entry, true)
					: {
							key: entry.key,
							value: entry.value,
							enabled: true,
							secret: false,
							source: "local",
							withheld: false,
						},
		);
	return [...defined, ...extra];
}

/** Collection variables (no local/shared split stored there) as a scope. */
export function entryVariables(
	entries: readonly VariableEntry[],
	localValues: readonly LocalValue[] = [],
): ScopeVariable[] {
	return scopeVariables(
		entries.map((entry, index) => ({
			id: String(index),
			key: entry.key.trim(),
			type: entry.secret ? "secret" : "default",
			enabled: entry.enabled !== false,
			description: "",
			sharedValue: entry.value,
			sharedHidden: false,
		})),
		localValues,
	);
}

/** Who wins for `name` across the layers, and what it overrides. */
export function resolveVariable(
	name: string,
	layers: readonly ResolverLayer[],
): VariableResolution {
	const key = name.trim();
	const enabled: VariableCandidate[] = [];
	const disabled: VariableCandidate[] = [];
	for (const layer of layers) {
		for (const variable of layer.variables) {
			if (variable.key !== key) continue;
			const candidate: VariableCandidate = {
				...variable,
				kind: layer.kind,
				...(layer.label === undefined ? {} : { label: layer.label }),
			};
			// A withheld secret still wins: a send using it stops (SECRET_WITHHELD)
			// until the caller sets a local value; no lower value stands in.
			const usable =
				variable.enabled && (variable.source !== "none" || variable.withheld);
			(usable ? enabled : disabled).push(candidate);
		}
	}
	const winner = enabled.at(-1) ?? null;
	const lower = enabled.slice(0, -1).reverse();
	return { winner, overridden: [...lower, ...disabled] };
}

function declaredNames(layers: readonly ResolverLayer[]): string[] {
	const names = new Set<string>();
	for (const layer of layers) {
		for (const variable of layer.variables) names.add(variable.key);
	}
	return [...names];
}

/**
 * The winning value of every name as one interpolation scope: what can
 * be filled in on this side. A name won by a withheld secret is left out
 * (no lower value stands in for it), so `{{name}}` stays unresolved.
 */
export function interpolationScope(layers: readonly ResolverLayer[]): {
	name: string;
	variables: VariableEntry[];
} {
	const variables = declaredNames(layers).flatMap((name): VariableEntry[] => {
		const { winner } = resolveVariable(name, layers);
		if (!winner || winner.withheld || winner.value === null) return [];
		return [{ key: name, value: winner.value, secret: winner.secret }];
	});
	return { name: "variables", variables };
}

/** Names won by a secret hidden from the caller; a send using one stops. */
export function withheldNames(layers: readonly ResolverLayer[]): string[] {
	return declaredNames(layers).filter(
		(name) => resolveVariable(name, layers).winner?.withheld === true,
	);
}
