/**
 * Several scripts of one phase run one after another: for a request of a
 * collection, the collection's, then each folder's (outer first), then
 * the request's own. Each sees the request and `lm.variables` the one
 * before left; the first error stops the chain (a pre-request error means
 * "do not send"). Their tests and logs show together, in run order.
 */
import type {
	ApiRequestDraft,
	ClientResponse,
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
	outcome: ScriptOutcome | null;
	error: ScriptError | null;
}

export async function runPreScripts(
	scripts: readonly string[],
	draft: ApiRequestDraft,
	runner: ScriptRunner,
	newId: () => string,
): Promise<PreChainResult> {
	let toSend = draft;
	let variables: Record<string, string> = {};
	let outcome: ScriptOutcome | null = null;
	for (const script of scripts) {
		const result = await runner.run({
			phase: "pre",
			script,
			request: toScriptRequest(toSend),
			environment: {},
			variables,
		});
		outcome = mergeOutcomes(outcome, scriptOutcome(result));
		if (result.error) {
			return { toSend: draft, variables: {}, outcome, error: result.error };
		}
		toSend = applyScriptRequest(toSend, result.request, newId);
		variables = result.variables;
	}
	return { toSend, variables, outcome, error: null };
}

export async function runPostScripts(
	scripts: readonly string[],
	sent: ApiRequestDraft,
	variables: Record<string, string>,
	response: ClientResponse,
	runner: ScriptRunner,
): Promise<ScriptOutcome | null> {
	let outcome: ScriptOutcome | null = null;
	let current = variables;
	for (const script of scripts) {
		const result = await runner.run({
			phase: "post",
			script,
			request: toScriptRequest(sent),
			environment: {},
			variables: current,
			response,
		});
		outcome = mergeOutcomes(outcome, scriptOutcome(result));
		if (result.error) break;
		current = result.variables;
	}
	return outcome;
}
