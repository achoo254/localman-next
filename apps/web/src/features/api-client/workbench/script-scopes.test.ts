import {
	type ClientResponse,
	type ResolverLayer,
	type ScriptScopeChanges,
	type VariableView,
	createRequestDraft,
	scopeVariables,
} from "@localman/shared/api-client";
import type {
	ScriptRunInput,
	ScriptRunResult,
	ScriptRunner,
} from "@localman/shared/api-client/script-sandbox";
import { describe, expect, it } from "vitest";
import { finishSend, prepareSend } from "./send-steps";

/**
 * A script `scope.key=value` sets that scope's key, `scope.key=` unsets
 * it (scope: globals, collectionVariables or environment); it also
 * records what it was given, to check the inputs.
 */
const seen: ScriptRunInput[] = [];
const runner: ScriptRunner = {
	run: async (input: ScriptRunInput): Promise<ScriptRunResult> => {
		seen.push(input);
		const scopes = {
			globals: { ...input.globals },
			collectionVariables: { ...input.collectionVariables },
			environment: { ...input.environment },
		};
		const match =
			/^(globals|collectionVariables|environment)\.(\w+)=(.*)$/.exec(
				input.script,
			);
		if (match) {
			const [, scope, key, value] = match;
			const target = scopes[scope as keyof typeof scopes];
			if (key && value) target[key] = value;
			else if (key) delete target[key];
		}
		return {
			request: input.request,
			...scopes,
			variables: { ...input.variables },
			tests: [],
			logs: [],
			logsTruncated: false,
			error: null,
		};
	},
};

const variable = (key: string, sharedValue: string): VariableView => ({
	id: key,
	key,
	type: "default",
	enabled: true,
	description: "",
	sharedValue,
	sharedHidden: false,
});

const layers: ResolverLayer[] = [
	{
		kind: "global",
		variables: scopeVariables([variable("token", "g-token")], []),
	},
	{
		kind: "environment",
		variables: scopeVariables([variable("host", "staging.test")], []),
	},
];

const response: ClientResponse = {
	status: 200,
	statusText: "OK",
	headers: [],
	body: "{}",
	bodyEncoding: "utf8",
	size: 2,
	timings: { dns: null, connect: null, tls: null, ttfb: 1, total: 1 },
	finalUrl: "https://prod.test/users",
	truncated: false,
};

async function sendWith(pre: string, post: string) {
	seen.length = 0;
	const draft = createRequestDraft({
		url: "https://{{host}}/users",
		scripts: { pre, post },
	});
	const signal = new AbortController().signal;
	const reported: ScriptScopeChanges[] = [];
	const onScopeChanges = (changes: ScriptScopeChanges) => {
		reported.push(changes);
	};
	const ready = await prepareSend(
		{ draft, files: new Map(), signal, variables: layers, onScopeChanges },
		runner,
	);
	if (!ready.ok) throw new Error("not ready");
	const afterPre = reported.length;
	await finishSend(ready, { response, route: "proxy" }, runner);
	return { ready, reported, afterPre };
}

describe("scripts and the variable scopes of a send", () => {
	it("gives each scope's values to the scripts", async () => {
		await sendWith("globals.noop=", "");
		expect(seen[0]?.globals).toEqual({ token: "g-token" });
		expect(seen[0]?.environment).toEqual({ host: "staging.test" });
		expect(seen[0]?.collectionVariables).toEqual({});
	});

	it("fills {{name}} with what the pre-request script set", async () => {
		const { ready } = await sendWith("environment.host=prod.test", "");
		expect(ready.prepared.url).toBe("https://prod.test/users");
	});

	it("reports the pre-request changes before the network, then all of them", async () => {
		const { reported, afterPre } = await sendWith(
			"environment.host=prod.test",
			"globals.token=",
		);
		// Known before the request goes out, so a failed send still keeps them.
		expect(afterPre).toBe(1);
		expect(reported[0]?.environment).toEqual([
			{ key: "host", value: "prod.test" },
		]);
		expect(reported.at(-1)).toEqual({
			globals: [{ key: "token", value: null }],
			collectionVariables: [],
			environment: [{ key: "host", value: "prod.test" }],
		});
	});

	it("reports nothing when the scripts change no scope", async () => {
		const { reported } = await sendWith("", "");
		expect(reported).toEqual([]);
	});
});
