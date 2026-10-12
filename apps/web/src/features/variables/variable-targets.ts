/**
 * The scopes a tab's variables come from and where a new one may go:
 * the layers for the resolver, built from what the queries hold, and the
 * scope choices of "Set as variable" and "Add to" with why one is closed.
 */
import {
	type EnvironmentDetail,
	type GlobalsDetail,
	type LocalValue,
	type ResolverLayer,
	type VariableEntry,
	entryVariables,
	scopeVariables,
} from "@localman/shared/api-client";
import {
	type TemporaryVariable,
	temporaryLayer,
} from "../api-client/workbench/temporary-variables";

export const TARGET_SCOPES = [
	"environment",
	"collection",
	"global",
	"temporary",
] as const;
export type TargetScope = (typeof TARGET_SCOPES)[number];

/** A scope that keeps shared values, as the caller sees it. */
export interface ScopeTarget {
	canEdit: boolean;
	/** Names defined in the scope, each with whether it is enabled. */
	defined: ReadonlyMap<string, boolean>;
	/** Names the caller has a local value for. */
	localKeys: ReadonlySet<string>;
}

export interface VariableTargets {
	workspaceId: string | null;
	/** The active environment; `null` when none is active. */
	environment: (ScopeTarget & { id: string; name: string }) | null;
	/** The collection of a bound tab; `null` for a loose request. */
	collection: (ScopeTarget & { id: string; name: string }) | null;
	/** `null` until the workspace's globals are known. */
	globals: ScopeTarget | null;
}

/** The shape of a scope's names: definitions and the caller's local values. */
export function scopeTarget(
	canEdit: boolean,
	variables: readonly { key: string; enabled?: boolean }[],
	localValues: readonly LocalValue[],
): ScopeTarget {
	return {
		canEdit,
		defined: new Map(
			variables.map((variable) => [
				variable.key.trim(),
				variable.enabled !== false,
			]),
		),
		localKeys: new Set(localValues.map((value) => value.key)),
	};
}

export interface LayerSources {
	globals: GlobalsDetail | undefined;
	/** The bound collection's variables (a send's context has no name). */
	collection:
		| { name?: string; variables: readonly VariableEntry[] }
		| undefined;
	collectionLocal: readonly LocalValue[] | undefined;
	environment: EnvironmentDetail | undefined;
	temporary: readonly TemporaryVariable[];
}

/**
 * Lowest first, as a send resolves them: globals, the bound collection,
 * the active environment (each with the caller's local values), then the
 * tab's temporary variables.
 */
export function buildVariableLayers(sources: LayerSources): ResolverLayer[] {
	const { globals, collection, environment } = sources;
	const layers: ResolverLayer[] = [];
	if (globals) {
		layers.push({
			kind: "global",
			variables: scopeVariables(globals.variables, globals.localValues),
		});
	}
	if (collection) {
		layers.push({
			kind: "collection",
			...(collection.name ? { label: collection.name } : {}),
			variables: entryVariables(
				collection.variables,
				sources.collectionLocal ?? [],
			),
		});
	}
	if (environment) {
		layers.push({
			kind: "environment",
			label: environment.name,
			variables: scopeVariables(environment.variables, environment.localValues),
		});
	}
	if (sources.temporary.length > 0) {
		layers.push(temporaryLayer(sources.temporary));
	}
	return layers;
}

/** Why a scope cannot take the variable. */
export type ChoiceBlock =
	| "editorsOnly"
	| "noEnvironment"
	| "noCollection"
	| "noWorkspace";

export interface ScopeChoice {
	scope: TargetScope;
	/** The environment's or collection's name. */
	name?: string;
	blocked: ChoiceBlock | null;
	/** What the scope holds already; absent for temporary variables. */
	target?: ScopeTarget;
}

/** A name already in the chosen scope: writing it replaces its shared value. */
export interface ExistingVariable {
	enabled: boolean;
	/** The caller's local value hides the shared one; it gets reset. */
	hasLocal: boolean;
}

export function existingIn(
	choice: ScopeChoice | undefined,
	rawKey: string,
): ExistingVariable | null {
	const key = rawKey.trim();
	const enabled = choice?.target?.defined.get(key);
	if (!choice?.target || enabled === undefined) return null;
	return { enabled, hasLocal: choice.target.localKeys.has(key) };
}

function editable(
	target: { canEdit: boolean } | null,
	missing: ChoiceBlock,
): ChoiceBlock | null {
	if (!target) return missing;
	return target.canEdit ? null : "editorsOnly";
}

/** Every scope in `TARGET_SCOPES` order; only Editors write shared scopes. */
export function scopeChoices(targets: VariableTargets): ScopeChoice[] {
	const { environment, collection, globals } = targets;
	return [
		{
			scope: "environment",
			...(environment ? { name: environment.name, target: environment } : {}),
			blocked: editable(environment, "noEnvironment"),
		},
		{
			scope: "collection",
			...(collection ? { name: collection.name, target: collection } : {}),
			blocked: editable(collection, "noCollection"),
		},
		{
			scope: "global",
			...(globals ? { target: globals } : {}),
			blocked: editable(globals, "noWorkspace"),
		},
		{ scope: "temporary", blocked: null },
	];
}

/** The active environment when it can take it, else a temporary variable. */
export function defaultScope(choices: readonly ScopeChoice[]): TargetScope {
	const environment = choices.find((choice) => choice.scope === "environment");
	return environment && environment.blocked === null
		? "environment"
		: "temporary";
}
