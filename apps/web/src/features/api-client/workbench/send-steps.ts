/**
 * Steps every sender shares, whatever the route: the pre-request script
 * and `{{var}}` before the network, the post-response script and the
 * result after it. The route itself (proxy, direct, tunnel) sits between.
 */
import {
	type ApiRequestDraft,
	type ClientResponse,
	type PreparedRequest,
	RequestPrepareError,
	type ScriptScopeValues,
	type VariableScope,
	prepareRequest,
	withScriptScopes,
} from "@localman/shared/api-client";
import type { ScriptRunner } from "@localman/shared/api-client/script-sandbox";
import { activeTranslator } from "../../../i18n/active-translator";
import { withVerbatimQuery } from "../request/params-sync";
import { bodyFiles } from "./body-files";
import { fakerForSend } from "./faker-loader";
import { nonBlankScripts, runPostScripts, runPreScripts } from "./script-chain";
import { givenScopesOf, reportScopes } from "./script-scopes";
import { scriptVariableScope } from "./script-steps";
import {
	prepareErrorMessage,
	scriptErrorMessage,
	withheldMessage,
} from "./send-messages";
import type { SendInput } from "./send-types";
import { variableScopes, withheldUsed } from "./send-variables";
import { newId } from "./workbench-ids";
import type {
	RouteInfo,
	ScriptOutcome,
	SendFailure,
	SendRoute,
	SettledResponse,
} from "./workbench-types";

export const CANCELLED: SettledResponse = { kind: "cancelled" };

export function failed(
	failure: Omit<SendFailure, "status" | "preScript"> &
		Partial<Pick<SendFailure, "status" | "preScript">>,
): SettledResponse {
	return {
		kind: "failed",
		failure: { status: null, preScript: null, ...failure },
	};
}

/** A request ready for the network, with what the pre-request script left. */
export interface ReadySend {
	ok: true;
	/** The draft after the pre-request script (only this send uses it). */
	toSend: ApiRequestDraft;
	prepared: PreparedRequest;
	variables: Record<string, string>;
	/** What the scripts saw of the scopes before running. */
	givenScopes: ScriptScopeValues;
	/** The scopes after the pre-request scripts. */
	scopes: ScriptScopeValues;
	onScopeChanges?: SendInput["onScopeChanges"];
	preScript: ScriptOutcome | null;
	/** Post-response scripts in run order (collection first). */
	postScripts: string[];
}

export type PrepareOutcome =
	| ReadySend
	| { ok: false; settled: SettledResponse };

/**
 * Runs the pre-request scripts, then fills `{{var}}`, auth and the body.
 * A tab bound to a collection request (`context`) runs the collection's
 * and folders' scripts around its own, takes the inherited auth, and
 * resolves `{{var}}` from globals, collection and environment variables
 * (with the caller's local values), then `lm.variables` of the scripts.
 */
export async function prepareSend(
	input: SendInput,
	scripts: ScriptRunner,
): Promise<PrepareOutcome> {
	const { draft, files, signal, context } = input;
	const { t } = activeTranslator();
	const base: ApiRequestDraft =
		context && draft.auth.type === "inherit"
			? { ...draft, auth: context.inheritedAuth }
			: draft;
	const pre = context
		? nonBlankScripts(context.preScripts)
		: nonBlankScripts([draft.scripts.pre]);
	const postScripts = context
		? nonBlankScripts(context.postScripts)
		: nonBlankScripts([draft.scripts.post]);
	const givenScopes = givenScopesOf(input);
	const chain = await runPreScripts(pre, base, scripts, newId, givenScopes);
	const preScript = chain.outcome;
	if (chain.error) {
		const message = t("apiClient.send.preScriptFailed", {
			reason: scriptErrorMessage(chain.error),
		});
		const code = chain.error.code;
		return { ok: false, settled: failed({ code, message, preScript }) };
	}
	const { toSend, variables } = chain;
	// Saved even when the request then fails or is cancelled, as in Postman.
	reportScopes(input.onScopeChanges, givenScopes, chain.scopes);
	if (signal.aborted) return { ok: false, settled: CANCELLED };

	// A value a script set in a scope fills `{{name}}` in this very send.
	const layers = input.variables
		? withScriptScopes(input.variables, chain.scopes)
		: undefined;
	const withheld = withheldUsed(layers, toSend, variables);
	if (withheld) {
		const message = withheldMessage(withheld, layers);
		const code = "SECRET_WITHHELD";
		return { ok: false, settled: failed({ code, message, preScript }) };
	}
	const scopes: VariableScope[] = [
		...variableScopes(layers, context),
		scriptVariableScope(variables),
		...(input.extraScopes ?? []),
	];
	const faker = await fakerForSend(toSend);
	if (!faker.ok) {
		const message = t("apiClient.send.dynamicVariablesUnavailable");
		const code = "DYNAMIC_VARIABLES_UNAVAILABLE";
		return { ok: false, settled: failed({ code, message, preScript }) };
	}
	if (signal.aborted) return { ok: false, settled: CANCELLED };
	try {
		const prepared = prepareRequest(withVerbatimQuery(toSend), {
			variables: { scopes, runFaker: faker.runFaker },
			files: await bodyFiles(toSend, files),
		});
		return {
			ok: true,
			toSend,
			prepared,
			variables,
			givenScopes,
			scopes: chain.scopes,
			onScopeChanges: input.onScopeChanges,
			preScript,
			postScripts,
		};
	} catch (error) {
		if (error instanceof RequestPrepareError) {
			const message = prepareErrorMessage(error);
			return {
				ok: false,
				settled: failed({ code: error.code, message, preScript }),
			};
		}
		const message = t("apiClient.send.fileUnreadable");
		return {
			ok: false,
			settled: failed({ code: "FILE_UNREADABLE", message, preScript }),
		};
	}
}

export interface Delivered {
	response: ClientResponse;
	route: SendRoute;
	routing?: RouteInfo;
}

/** Runs the post-response scripts and builds the tab's result. */
export async function finishSend(
	ready: ReadySend,
	delivered: Delivered,
	scripts: ScriptRunner,
): Promise<SettledResponse> {
	const { toSend, prepared, variables, preScript } = ready;
	const post = await runPostScripts(
		ready.postScripts,
		toSend,
		variables,
		delivered.response,
		scripts,
		ready.scopes,
	);
	reportScopes(ready.onScopeChanges, ready.givenScopes, post.scopes);
	return {
		kind: "done",
		result: {
			response: delivered.response,
			route: delivered.route,
			request: { method: prepared.method, url: prepared.url },
			preScript,
			postScript: post.outcome,
			finishedAt: new Date().toISOString(),
			...(delivered.routing ? { routing: delivered.routing } : {}),
		},
	};
}
