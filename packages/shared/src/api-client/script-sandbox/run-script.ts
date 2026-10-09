/**
 * Runs pre-request and post-response scripts in QuickJS. The WASM build is
 * supplied by the caller and loaded on the first non-empty script only:
 * the web passes its worker's variant, Node tests (and later the API) pass
 * `@jitl/quickjs-wasmfile-release-sync`.
 *
 * A run is synchronous once the module is loaded, so call it from a worker
 * in the browser; the deadline bounds it, `Worker.terminate()` stays the
 * backstop.
 */
import {
	type QuickJSSyncVariant,
	type QuickJSWASMModule,
	newQuickJSWASMModuleFromVariant,
} from "quickjs-emscripten-core";
import { MAX_SCRIPT_LENGTH } from "../limits.js";
import { type SessionOutcome, runSession } from "./sandbox-session.js";
import { scriptErrorFromHost } from "./script-error.js";
import { readSandboxOutput } from "./script-output.js";
import type {
	ScriptError,
	ScriptRunInput,
	ScriptRunResult,
} from "./script-types.js";

/** Resolves the variant itself or its module (`() => import("…")`). */
export type QuickJSVariantLoader = () => Promise<
	QuickJSSyncVariant | { default: QuickJSSyncVariant }
>;

export interface ScriptRunner {
	/** Never rejects: every failure comes back in `result.error`. */
	run(input: ScriptRunInput): Promise<ScriptRunResult>;
}

function unchanged(
	input: ScriptRunInput,
	extra: Partial<ScriptRunResult> = {},
): ScriptRunResult {
	return {
		request: input.request,
		environment: { ...input.environment },
		variables: { ...input.variables },
		tests: [],
		logs: [],
		logsTruncated: false,
		error: null,
		...extra,
	};
}

function toResult(
	input: ScriptRunInput,
	{ error, json }: SessionOutcome,
): ScriptRunResult {
	const output = json === null ? null : readSandboxOutput(json, input.phase);
	if (output === null || "code" in output) {
		return unchanged(input, { error: error ?? output ?? null });
	}
	const { tests, logs, logsTruncated, requestProblem } = output;
	const failed: ScriptError | null =
		error ??
		(requestProblem ? { code: "SCRIPT_ERROR", message: requestProblem } : null);
	if (failed) {
		return unchanged(input, { tests, logs, logsTruncated, error: failed });
	}
	return {
		request: output.request ?? input.request,
		environment: output.environment,
		variables: output.variables,
		tests,
		logs,
		logsTruncated,
		error: null,
	};
}

function messageOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

export function createScriptRunner(
	loadVariant: QuickJSVariantLoader,
): ScriptRunner {
	let pending: Promise<QuickJSWASMModule> | null = null;
	/** Modules a host exception unwound through; their heap is not trusted. */
	const broken = new WeakSet<QuickJSWASMModule>();

	const loadModule = (): Promise<QuickJSWASMModule> => {
		if (!pending) {
			const loading = loadVariant().then((loaded) =>
				newQuickJSWASMModuleFromVariant(
					"default" in loaded ? loaded.default : loaded,
				),
			);
			// A failed load is retried by the next run instead of cached.
			loading.catch(() => {
				if (pending === loading) pending = null;
			});
			pending = loading;
		}
		return pending;
	};

	return {
		async run(input) {
			if (input.script.length > MAX_SCRIPT_LENGTH) {
				const message = `The script is longer than ${MAX_SCRIPT_LENGTH} characters`;
				return unchanged(input, {
					error: { code: "SCRIPT_TOO_LONG", message },
				});
			}
			if (!input.script.trim()) return unchanged(input);
			let module: QuickJSWASMModule;
			try {
				module = await loadModule();
				// Another run broke it while this one was waiting.
				if (broken.has(module)) module = await loadModule();
			} catch (cause) {
				return unchanged(input, {
					error: { code: "SCRIPT_UNAVAILABLE", message: messageOf(cause) },
				});
			}
			try {
				return toResult(input, runSession(module, input));
			} catch (cause) {
				broken.add(module);
				pending = null;
				return unchanged(input, { error: scriptErrorFromHost(cause) });
			}
		},
	};
}
