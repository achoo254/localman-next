/**
 * Several scripts of one phase run one after another: for a request of a
 * collection, the collection's, then each folder's (outer first), then
 * the request's own. Each sees the request, `lm.variables` and the scopes
 * (`lm.globals`, `lm.collectionVariables`, `lm.environment`) the one
 * before left; the first error stops the chain (a pre-request error means
 * "do not send", and no scope change of the chain is kept). Their tests
 * and logs show together, in run order.
 */
import type {
	ApiRequestDraft,
	ClientResponse,
	ScriptScopeValues,
} from "@localman/shared/api-client";
import type {
	ScriptError,
	ScriptRunner,
} from "@localman/shared/api-client/script-sandbox";
import {
	applyScriptRequest,
	scriptOutcome,
	toScriptRequest,
} from "./script-steps";
import type { ScriptOutcome } from "./workbench-types";

/** Two outcomes as one: tests and logs in order, the first error kept. */
export function mergeOutcomes(
	a: ScriptOutcome | null,
	b: ScriptOutcome,
): ScriptOutcome {
	if (!a) return b;
	return {
		tests: [...a.tests, ...b.tests],
		logs: [...a.logs, ...b.logs],
		logsTruncated: a.logsTruncated || b.logsTruncated,
		error: a.error ?? b.error,
	};
}

/** Scripts worth running: the blank ones are skipped. */
export function nonBlankScripts(scripts: readonly string[]): string[] {
	return scripts.filter((script) => script.trim() !== "");
}

export interface PreChainResult {
	toSend: ApiRequestDraft;
	variables: Record<string, string>;
	/** The scopes as the scripts left them (as given after an error). */
	scopes: ScriptScopeValues;
	outcome: ScriptOutcome | null;
	error: ScriptError | null;
}

function scopesOf(result: ScriptScopeValues): ScriptScopeValues {
	const { globals, collectionVariables, environment } = result;
	return { globals, collectionVariables, environment };
}

export async function runPreScripts(
	scripts: readonly string[],
	draft: ApiRequestDraft,
	runner: ScriptRunner,
	newId: () => string,
	given: ScriptScopeValues,
): Promise<PreChainResult> {
	let toSend = draft;
	let variables: Record<string, string> = {};
	let scopes = given;
	let outcome: ScriptOutcome | null = null;
	for (const script of scripts) {
		const result = await runner.run({
			phase: "pre",
			script,
			request: toScriptRequest(toSend),
			...scopes,
			variables,
		});
		outcome = mergeOutcomes(outcome, scriptOutcome(result));
		if (result.error) {
			const error = result.error;
			return { toSend: draft, variables: {}, scopes: given, outcome, error };
		}
		toSend = applyScriptRequest(toSend, result.request, newId);
		variables = result.variables;
		scopes = scopesOf(result);
	}
	return { toSend, variables, scopes, outcome, error: null };
}

export interface PostChainResult {
	outcome: ScriptOutcome | null;
	/** Scopes after the scripts that ran without an error. */
	scopes: ScriptScopeValues;
}

export async function runPostScripts(
	scripts: readonly string[],
	sent: ApiRequestDraft,
	variables: Record<string, string>,
	response: ClientResponse,
	runner: ScriptRunner,
	given: ScriptScopeValues,
): Promise<PostChainResult> {
	let outcome: ScriptOutcome | null = null;
	let current = variables;
	let scopes = given;
	for (const script of scripts) {
		const result = await runner.run({
			phase: "post",
			script,
			request: toScriptRequest(sent),
			...scopes,
			variables: current,
			response,
		});
		outcome = mergeOutcomes(outcome, scriptOutcome(result));
		if (result.error) break;
		current = result.variables;
		scopes = scopesOf(result);
	}
	return { outcome, scopes };
}
