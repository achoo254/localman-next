/**
 * One script run inside a loaded QuickJS module: a fresh runtime with a
 * memory cap, a stack cap and an interrupt deadline, torn down before
 * returning. Every handle is freed on the way; when the host engine throws
 * out of QuickJS (its own stack ran out first) the exception propagates
 * and the caller must discard the module instead of disposing anything.
 */
import type {
	QuickJSContext,
	QuickJSHandle,
	QuickJSRuntime,
	QuickJSWASMModule,
} from "quickjs-emscripten-core";
import { base64ToBytes } from "../byte-encoding.js";
import {
	MAX_RESPONSE_BODY_BYTES,
	SCRIPT_MAX_STACK_BYTES,
	SCRIPT_MEMORY_BYTES,
	SCRIPT_TIMEOUT_MS,
} from "../limits.js";
import type { ClientResponse } from "../response-model.js";
import { scriptErrorFromDump } from "./script-error.js";
import {
	PRELUDE_FILE_NAME,
	SCRIPT_FILE_NAME,
	SCRIPT_PRELUDE_SOURCE,
} from "./script-prelude.js";
import type { ScriptError, ScriptRunInput } from "./script-types.js";

/** Room for `finish` to serialise results after the script hit a cap. */
const FINISH_GRACE_MS = 250;
const FINISH_EXTRA_MEMORY_BYTES = 4 * 1024 * 1024;

export interface SessionOutcome {
	/** What stopped the script, if anything. */
	error: ScriptError | null;
	/** JSON from the prelude's `finish`; `null` if it could not run. */
	json: string | null;
}

interface Sandbox {
	vm: QuickJSContext;
	runtime: QuickJSRuntime;
	/** Moves the interrupt deadline `ms` from now. */
	allow(ms: number): void;
	/** Turns a thrown QuickJS value into an error and frees it. */
	fail(handle: QuickJSHandle): ScriptError;
}

/** Body as text; a non-UTF-8 body is decoded lossily, like `fetch().text()`. */
function responseText(response: ClientResponse): string {
	let text = response.body;
	if (response.bodyEncoding === "base64") {
		try {
			text = new TextDecoder().decode(base64ToBytes(response.body));
		} catch {
			text = "";
		}
	}
	return text.slice(0, MAX_RESPONSE_BODY_BYTES);
}

/** Everything but the body, which goes in as its own string. */
function vmInputJson(input: ScriptRunInput): string {
	const { phase, request, environment, variables } = input;
	let response = null;
	if (input.phase === "post") {
		const { body: _body, bodyEncoding: _encoding, ...rest } = input.response;
		response = rest;
	}
	return JSON.stringify({ phase, request, environment, variables, response });
}

function dumpAndDispose(vm: QuickJSContext, handle: QuickJSHandle): unknown {
	try {
		return vm.dump(handle);
	} catch {
		return undefined;
	} finally {
		handle.dispose();
	}
}

function openSandbox(module: QuickJSWASMModule): Sandbox {
	let deadline = Date.now() + SCRIPT_TIMEOUT_MS;
	let timedOut = false;
	const runtime = module.newRuntime();
	runtime.setMemoryLimit(SCRIPT_MEMORY_BYTES);
	runtime.setMaxStackSize(SCRIPT_MAX_STACK_BYTES);
	runtime.setInterruptHandler(() => {
		if (Date.now() < deadline) return false;
		timedOut = true;
		return true;
	});
	const vm = runtime.newContext();
	return {
		vm,
		runtime,
		allow: (ms) => {
			deadline = Date.now() + ms;
		},
		fail: (handle) => scriptErrorFromDump(dumpAndDispose(vm, handle), timedOut),
	};
}

/** Evaluates the prelude and returns its `finish` function. */
function startPrelude(
	box: Sandbox,
	input: ScriptRunInput,
): QuickJSHandle | ScriptError {
	const { vm } = box;
	const setup = vm.evalCode(SCRIPT_PRELUDE_SOURCE, PRELUDE_FILE_NAME);
	if (setup.error) return box.fail(setup.error);
	const json = vm.newString(vmInputJson(input));
	const body = vm.newString(
		input.phase === "post" ? responseText(input.response) : "",
	);
	const made = vm.callFunction(setup.value, vm.undefined, json, body);
	setup.value.dispose();
	json.dispose();
	body.dispose();
	return made.error ? box.fail(made.error) : made.value;
}

/** Runs the script, then the promise jobs it queued (async tests). */
function runUserScript(box: Sandbox, script: string): ScriptError | null {
	const ran = box.vm.evalCode(script, SCRIPT_FILE_NAME);
	if (ran.error) return box.fail(ran.error);
	ran.value.dispose();
	const jobs = box.runtime.executePendingJobs();
	return jobs.error ? box.fail(jobs.error) : null;
}

/** Collects results; `null` if even `finish` could not run. */
function collect(box: Sandbox, finish: QuickJSHandle): string | null {
	const { vm, runtime } = box;
	box.allow(FINISH_GRACE_MS);
	runtime.setMemoryLimit(SCRIPT_MEMORY_BYTES + FINISH_EXTRA_MEMORY_BYTES);
	const done = vm.callFunction(finish, vm.undefined);
	finish.dispose();
	if (done.error) {
		done.error.dispose();
		return null;
	}
	const isString = vm.typeof(done.value) === "string";
	const json = isString ? vm.getString(done.value) : null;
	done.value.dispose();
	return json;
}

export function runSession(
	module: QuickJSWASMModule,
	input: ScriptRunInput,
): SessionOutcome {
	const box = openSandbox(module);
	const started = startPrelude(box, input);
	let outcome: SessionOutcome;
	if ("code" in started) outcome = { error: started, json: null };
	else {
		const error = runUserScript(box, input.script);
		outcome = { error, json: collect(box, started) };
	}
	box.vm.dispose();
	box.runtime.dispose();
	return outcome;
}
