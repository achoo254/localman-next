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
	prepareRequest,
} from "@localman/shared/api-client";
import type { ScriptRunner } from "@localman/shared/api-client/script-sandbox";
import { activeTranslator } from "../../../i18n/active-translator";
import { readFileBytes } from "../../../platform/file-read";
import { withVerbatimQuery } from "../request/params-sync";
import {
	applyScriptRequest,
	scriptOutcome,
	scriptVariableScope,
	toScriptRequest,
} from "./script-steps";
import { prepareErrorMessage, scriptErrorMessage } from "./send-messages";
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

/** Runs the pre-request script, then fills `{{var}}`, auth and the body. */
export async function prepareSend(
	{ draft, files, signal }: SendInput,
	scripts: ScriptRunner,
): Promise<PrepareOutcome> {
	const { t } = activeTranslator();
	let preScript: ScriptOutcome | null = null;
	let toSend = draft;
	let variables: Record<string, string> = {};
	if (draft.scripts.pre.trim()) {
		const result = await scripts.run({
			phase: "pre",
			script: draft.scripts.pre,
			request: toScriptRequest(draft),
			environment: {},
			variables: {},
		});
		preScript = scriptOutcome(result);
		if (result.error) {
			const message = t("apiClient.send.preScriptFailed", {
				reason: scriptErrorMessage(result.error),
			});
			const code = result.error.code;
			return { ok: false, settled: failed({ code, message, preScript }) };
		}
		toSend = applyScriptRequest(draft, result.request, newId);
		variables = result.variables;
	}
	if (signal.aborted) return { ok: false, settled: CANCELLED };

	try {
		const prepared = prepareRequest(withVerbatimQuery(toSend), {
			variables: { scopes: [scriptVariableScope(variables)] },
			files: await bodyFiles(toSend, files),
		});
		return { ok: true, toSend, prepared, variables, preScript };
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

/** Runs the post-response script and builds the tab's result. */
export async function finishSend(
	draft: ApiRequestDraft,
	ready: ReadySend,
	delivered: Delivered,
	scripts: ScriptRunner,
): Promise<SettledResponse> {
	const { toSend, prepared, variables, preScript } = ready;
	let postScript: ScriptOutcome | null = null;
	if (draft.scripts.post.trim()) {
		const result = await scripts.run({
			phase: "post",
			script: draft.scripts.post,
			request: toScriptRequest(toSend),
			environment: {},
			variables,
			response: delivered.response,
		});
		postScript = scriptOutcome(result);
	}
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
