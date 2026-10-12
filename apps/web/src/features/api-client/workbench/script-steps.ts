/**
 * Pre-request and post-response scripts around a send. The QuickJS
 * sandbox (and its WASM) is imported on the first non-empty script only;
 * a page that never runs a script never downloads it.
 */
import {
	type ApiRequestDraft,
	type VariableScope,
	parseQueryFromUrl,
} from "@localman/shared/api-client";
import type {
	ScriptRequest,
	ScriptRunResult,
	ScriptRunner,
} from "@localman/shared/api-client/script-sandbox";
import type { ScriptOutcome } from "./workbench-types";

/** Same runner for every send; QuickJS stays loaded once it is. */
export function createLazyScriptRunner(): ScriptRunner {
	let loading: Promise<ScriptRunner> | null = null;
	const load = async (): Promise<ScriptRunner> => {
		const { createScriptRunner } = await import(
			"@localman/shared/api-client/script-sandbox"
		);
		return createScriptRunner(
			() => import("@jitl/quickjs-wasmfile-release-sync"),
		);
	};
	return {
		async run(input) {
			loading ??= load();
			try {
				return await (await loading).run(input);
			} catch (cause) {
				// The sandbox chunk itself failed to load: try again next time.
				loading = null;
				return {
					request: input.request,
					globals: { ...input.globals },
					collectionVariables: { ...input.collectionVariables },
					environment: { ...input.environment },
					variables: { ...input.variables },
					tests: [],
					logs: [],
					logsTruncated: false,
					error: {
						code: "SCRIPT_UNAVAILABLE",
						message: cause instanceof Error ? cause.message : String(cause),
					},
				};
			}
		},
	};
}

/** The request as a script sees it: as typed, `{{var}}` not filled yet. */
export function toScriptRequest(draft: ApiRequestDraft): ScriptRequest {
	return {
		method: draft.method,
		url: draft.url,
		headers: draft.headers
			.filter((row) => row.enabled && row.key.trim())
			.map((row) => ({ name: row.key.trim(), value: row.value })),
		body: draft.body.type === "raw" ? draft.body.raw : null,
	};
}

/**
 * The draft to send after a pre-request script changed `lm.request`. Only
 * this send uses it; the tab keeps what the user typed.
 */
export function applyScriptRequest(
	draft: ApiRequestDraft,
	request: ScriptRequest,
	newId: () => string,
): ApiRequestDraft {
	const before = toScriptRequest(draft);
	const sameHeaders =
		JSON.stringify(before.headers) === JSON.stringify(request.headers);
	const textBody = draft.body.type === "raw" || draft.body.type === "none";
	return {
		...draft,
		method: request.method,
		url: request.url,
		params:
			request.url === draft.url
				? draft.params
				: parseQueryFromUrl(request.url, newId),
		headers: sameHeaders
			? draft.headers
			: request.headers.map(({ name, value }) => ({
					id: newId(),
					key: name,
					value,
					enabled: true,
				})),
		body:
			request.body !== null && request.body !== before.body && textBody
				? { ...draft.body, type: "raw", raw: request.body }
				: draft.body,
	};
}

/** `lm.variables` after the pre-request script, as a `{{var}}` scope. */
export function scriptVariableScope(
	variables: Readonly<Record<string, string>>,
): VariableScope {
	return {
		name: "lm.variables",
		variables: Object.entries(variables).map(([key, value]) => ({
			key,
			value,
		})),
	};
}

export function scriptOutcome(result: ScriptRunResult): ScriptOutcome {
	return {
		tests: result.tests,
		logs: result.logs,
		logsTruncated: result.logsTruncated,
		error: result.error,
	};
}
