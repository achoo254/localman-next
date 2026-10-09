/**
 * `{{name}}` and `{{$dynamic}}` interpolation. Single pass: a value that
 * itself contains `{{x}}` is not expanded again. Unknown names stay as
 * typed and are reported in `unresolved`.
 *
 * Besides the value, every result says which `secret` variables were
 * used, so the router can ask before such a request leaves the browser.
 */
import { resolveDynamicVariable } from "./dynamic-variables.js";

/** `{{ name }}`; names cannot contain braces, so `{{{x}}}` is `{` + x + `}`. */
export const VARIABLE_PATTERN = /\{\{([^{}]+)\}\}/g;

export interface VariableEntry {
	key: string;
	value: string;
	/** `type=secret`: masked in the UI, never sent to the proxy silently. */
	secret?: boolean;
	/** Disabled variables are skipped (default enabled). */
	enabled?: boolean;
}

export interface VariableScope {
	/** Label for the UI ("Globals", an environment name...). */
	name?: string;
	variables: readonly VariableEntry[];
}

/**
 * Scopes from lowest to highest precedence: a later scope overrides an
 * earlier one (globals, collection, environment, temporary).
 */
export interface InterpolationContext {
	scopes: readonly VariableScope[];
}

export interface InterpolationResult {
	value: string;
	/** Names left as typed, in order of first appearance. */
	unresolved: string[];
	/** Names of secret variables whose value was filled in. */
	secrets: string[];
}

interface ResolvedVariable {
	value: string;
	secret: boolean;
}

function buildLookup(
	context: InterpolationContext | undefined,
): Map<string, ResolvedVariable> {
	const lookup = new Map<string, ResolvedVariable>();
	for (const scope of context?.scopes ?? []) {
		for (const variable of scope.variables) {
			const key = variable.key.trim();
			if (!key || variable.enabled === false) continue;
			lookup.set(key, {
				value: variable.value,
				secret: variable.secret === true,
			});
		}
	}
	return lookup;
}

export interface Interpolator {
	/** Fill one string; names it used add up across calls. */
	apply(template: string): string;
	unresolved(): string[];
	secretsUsed(): string[];
}

/**
 * One interpolator per send, so the preparer collects `unresolved` and
 * `secretsUsed` over every field it fills.
 */
export function createInterpolator(
	context: InterpolationContext | undefined,
): Interpolator {
	const lookup = buildLookup(context);
	const unresolved = new Set<string>();
	const secrets = new Set<string>();

	const apply = (template: string): string =>
		template.replace(VARIABLE_PATTERN, (match, raw: string) => {
			const name = raw.trim();
			if (!name) return match;
			if (name.startsWith("$")) {
				const dynamic = resolveDynamicVariable(name);
				if (dynamic !== null) return dynamic;
				unresolved.add(name);
				return match;
			}
			const found = lookup.get(name);
			if (!found) {
				unresolved.add(name);
				return match;
			}
			if (found.secret) secrets.add(name);
			return found.value;
		});

	return {
		apply,
		unresolved: () => [...unresolved],
		secretsUsed: () => [...secrets],
	};
}

export function interpolate(
	template: string,
	context: InterpolationContext | undefined,
): InterpolationResult {
	const interpolator = createInterpolator(context);
	const value = interpolator.apply(template);
	return {
		value,
		unresolved: interpolator.unresolved(),
		secrets: interpolator.secretsUsed(),
	};
}

export function interpolateString(
	template: string,
	context: InterpolationContext | undefined,
): string {
	return interpolate(template, context).value;
}
