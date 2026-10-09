/** Shared fixtures for the sandbox tests: real QuickJS, sync WASM build. */
import type { ClientResponse } from "../response-model.js";
import { createScriptRunner } from "./run-script.js";
import type {
	PostScriptInput,
	PreScriptInput,
	ScriptRequest,
	ScriptRunResult,
} from "./script-types.js";

/**
 * Under NodeNext the package's CJS typings put the variant at
 * `.default.default`, while Node's ESM build has it at `.default`; the
 * loader accepts both shapes, so `.default` satisfies the types and runs.
 */
export const runner = createScriptRunner(
	async () => (await import("@jitl/quickjs-wasmfile-release-sync")).default,
);

export const baseRequest: ScriptRequest = {
	method: "GET",
	url: "https://api.example.com/users",
	headers: [{ name: "Accept", value: "application/json" }],
	body: null,
};

export const baseResponse: ClientResponse = {
	status: 200,
	statusText: "OK",
	headers: [
		{ name: "Content-Type", value: "application/json" },
		{ name: "Set-Cookie", value: "a=1" },
		{ name: "Set-Cookie", value: "b=2" },
	],
	body: JSON.stringify({ id: 7, tags: ["x", "y"], user: { name: "An" } }),
	bodyEncoding: "utf8",
	size: 48,
	timings: { dns: 1, connect: 2, tls: null, ttfb: 30, total: 42 },
	finalUrl: "https://api.example.com/users",
	truncated: false,
};

export function runPre(
	script: string,
	extra: Partial<PreScriptInput> = {},
): Promise<ScriptRunResult> {
	return runner.run({
		phase: "pre",
		script,
		request: baseRequest,
		environment: { baseUrl: "https://api.example.com" },
		variables: {},
		...extra,
	});
}

export function runPost(
	script: string,
	extra: Partial<PostScriptInput> = {},
): Promise<ScriptRunResult> {
	return runner.run({
		phase: "post",
		script,
		request: baseRequest,
		environment: {},
		variables: {},
		response: baseResponse,
		...extra,
	});
}
