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
	type VariableScope,
	prepareRequest,
} from "@localman/shared/api-client";
import type { ScriptRunner } from "@localman/shared/api-client/script-sandbox";
import { activeTranslator } from "../../../i18n/active-translator";
import { readFileBytes } from "../../../platform/file-read";
import { withVerbatimQuery } from "../request/params-sync";
import { nonBlankScripts, runPostScripts, runPreScripts } from "./script-chain";
import { scriptVariableScope } from "./script-steps";
import { prepareErrorMessage, scriptErrorMessage } from "./send-messages";
import { variableScopes, withheldUsed } from "./send-variables";
import { newId } from "./workbench-ids";
import type {
	RouteInfo,
	ScriptOutcome,
	SendFailure,
	SendInput,
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
	preScript: ScriptOutcome | null;
	/** Post-response scripts in run order (collection first). */
	postScripts: string[];
}

export type PrepareOutcome =
	| ReadySend
	| { ok: false; settled: SettledResponse };

/** Bytes of the files the active body refers to. */
async function bodyFiles(
	draft: ApiRequestDraft,
	files: ReadonlyMap<string, File>,
): Promise<Map<string, Uint8Array>> {
	const refs =
		draft.body.type === "binary"
			? [draft.body.binary]
			: draft.body.type === "formdata"
				? draft.body.formData.map((row) => (row.enabled ? row.file : null))
				: [];
	const bytes = new Map<string, Uint8Array>();
	for (const ref of refs) {
		const file = ref ? files.get(ref.fileId) : undefined;
		if (ref && file) bytes.set(ref.fileId, await readFileBytes(file));
	}
	return bytes;
}

/**
 * Runs the pre-request scripts, then fills `{{var}}`, auth and the body.
 * A tab bound to a collection request (`context`) runs the collection's
 * and folders' scripts around its own, takes the inherited auth for
 * `inherit`, and resolves `{{var}}` from, lowest to highest: globals,
 * collection and environment variables (each with the caller's local
 * values), then `lm.variables` set by the scripts.
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
	const chain = await runPreScripts(pre, base, scripts, newId);
	const preScript = chain.outcome;
	if (chain.error) {
		const message = t("apiClient.send.preScriptFailed", {
			reason: scriptErrorMessage(chain.error),
		});
		const code = chain.error.code;
		return { ok: false, settled: failed({ code, message, preScript }) };
	}
	const { toSend, variables } = chain;
	if (signal.aborted) return { ok: false, settled: CANCELLED };

	const withheld = withheldUsed(input.variables, toSend, variables);
	if (withheld) {
		const message = t("apiClient.send.secretWithheld", { name: withheld });
		return {
			ok: false,
			settled: failed({ code: "SECRET_WITHHELD", message, preScript }),
		};
	}
	const scopes: VariableScope[] = [
		...variableScopes(input.variables, context),
		scriptVariableScope(variables),
	];
	try {
		const prepared = prepareRequest(withVerbatimQuery(toSend), {
			variables: { scopes },
			files: await bodyFiles(toSend, files),
		});
		return { ok: true, toSend, prepared, variables, preScript, postScripts };
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
	const postScript = await runPostScripts(
		ready.postScripts,
		toSend,
		variables,
		delivered.response,
		scripts,
	);
	return {
		kind: "done",
		result: {
			response: delivered.response,
			route: delivered.route,
			request: { method: prepared.method, url: prepared.url },
			preScript,
			postScript,
			finishedAt: new Date().toISOString(),
			...(delivered.routing ? { routing: delivered.routing } : {}),
		},
	};
}
