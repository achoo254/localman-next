/**
 * Where a send's `{{name}}` values come from below the scripts, and the
 * secrets it may not fill in on this side.
 */
import {
	type ApiRequestDraft,
	type ResolverLayer,
	type VariableScope,
	extractUsedVariables,
	interpolationScope,
	withheldNames,
} from "@localman/shared/api-client";
import type { SendInput } from "./send-types";

/**
 * Scopes below the scripts' `lm.variables`: the resolved globals,
 * collection and environment (local values first) when they are given,
 * else the bound tab's collection variables.
 */
export function variableScopes(
	layers: readonly ResolverLayer[] | undefined,
	context: SendInput["context"],
): VariableScope[] {
	if (layers) return [interpolationScope(layers)];
	return context ? [{ name: "collection", variables: context.variables }] : [];
}

/**
 * The first name the request uses whose value is a secret withheld from
 * the caller (a Viewer without a local value), unless a script set it.
 */
export function withheldUsed(
	layers: readonly ResolverLayer[] | undefined,
	request: ApiRequestDraft,
	scriptValues: Readonly<Record<string, string>>,
): string | null {
	if (!layers) return null;
	const withheld = new Set(withheldNames(layers));
	return (
		extractUsedVariables(request).find(
			(name) => withheld.has(name) && !Object.hasOwn(scriptValues, name),
		) ?? null
	);
}
