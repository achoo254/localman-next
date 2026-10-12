/** The variable scopes scripts read through `lm.*` in a send. */
import {
	type ScriptScopeValues,
	emptyScriptScopes,
	hasScriptScopeChanges,
	scriptScopeChanges,
	scriptScopeValues,
} from "@localman/shared/api-client";
import type { SendInput } from "./send-types";

/**
 * What the scripts read of `lm.globals`, `lm.collectionVariables` and
 * `lm.environment`: the send's layers, or only the bound collection's
 * variables while environments are off.
 */
export function givenScopesOf(input: SendInput): ScriptScopeValues {
	if (input.variables) return scriptScopeValues(input.variables);
	const scopes = emptyScriptScopes();
	for (const entry of input.context?.variables ?? []) {
		const key = entry.key.trim();
		if (key && entry.enabled !== false)
			scopes.collectionVariables[key] = entry.value;
	}
	return scopes;
}

/** Tells `report` what the scripts changed since `given`, if anything. */
export function reportScopes(
	report: SendInput["onScopeChanges"],
	given: ScriptScopeValues,
	now: ScriptScopeValues,
): void {
	const changes = scriptScopeChanges(given, now);
	if (report && hasScriptScopeChanges(changes)) report(changes);
}
