import {
	type ResolverLayer,
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
import { prepareSend } from "./send-steps";

/** A pre-request script `key:value` sets `lm.variables[key]`. */
const runner: ScriptRunner = {
	run: async (input: ScriptRunInput): Promise<ScriptRunResult> => {
		const [key, value] = input.script.split(":");
		const variables = { ...input.variables };
		if (key && value !== undefined) variables[key] = value;
		return {
			request: input.request,
			globals: { ...input.globals },
			collectionVariables: { ...input.collectionVariables },
			environment: { ...input.environment },
			variables,
			tests: [],
			logs: [],
			logsTruncated: false,
			error: null,
		};
	},
};

const variable = (
	key: string,
	sharedValue: string | null,
	extra: Partial<VariableView> = {},
): VariableView => ({
	id: key,
	key,
	type: "default",
	enabled: true,
	description: "",
	sharedValue,
	sharedHidden: false,
	...extra,
});

const signal = new AbortController().signal;
const files = new Map<string, File>();

function send(url: string, layers: ResolverLayer[], pre = "") {
	const draft = createRequestDraft({ url, scripts: { pre, post: "" } });
	return prepareSend({ draft, files, signal, variables: layers }, runner);
}

describe("prepareSend with environments", () => {
	const layers: ResolverLayer[] = [
		{
			kind: "global",
			variables: scopeVariables([variable("host", "global.test")], []),
		},
		{
			kind: "environment",
			label: "Staging",
			variables: scopeVariables(
				[variable("host", "staging.test"), variable("version", "v1")],
				[{ key: "version", value: "v2" }],
			),
		},
	];

	it("uses the environment over the globals and the caller's local value", async () => {
		const ready = await send("https://{{host}}/{{version}}/users", layers);
		expect(ready.ok && ready.prepared.url).toBe(
			"https://staging.test/v2/users",
		);
	});

	it("lets a script's lm.variables override every scope", async () => {
		const ready = await send("https://{{host}}/x", layers, "host:script.test");
		expect(ready.ok && ready.prepared.url).toBe("https://script.test/x");
	});

	const withheld: ResolverLayer[] = [
		{
			kind: "environment",
			variables: scopeVariables(
				[variable("token", null, { type: "secret", sharedHidden: true })],
				[],
			),
		},
	];

	it("stops before the network on a secret withheld from the caller", async () => {
		const outcome = await send("https://api.test/?t={{token}}", withheld);
		expect(outcome.ok).toBe(false);
		if (outcome.ok || outcome.settled.kind !== "failed")
			throw new Error("sent");
		expect(outcome.settled.failure.code).toBe("SECRET_WITHHELD");
		expect(outcome.settled.failure.message).toContain("token");
	});

	it("sends when a script set that name itself", async () => {
		const outcome = await send(
			"https://api.test/?t={{token}}",
			withheld,
			"token:abc",
		);
		expect(outcome.ok && outcome.prepared.url).toBe("https://api.test/?t=abc");
	});
});
