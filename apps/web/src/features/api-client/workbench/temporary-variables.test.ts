import {
	type ResolverLayer,
	type VariableView,
	createRequestDraft,
	scopeVariables,
} from "@localman/shared/api-client";
import type { ScriptRunner } from "@localman/shared/api-client/script-sandbox";
import { describe, expect, it } from "vitest";
import { prepareSend } from "./send-steps";
import {
	type TemporaryVariable,
	withTemporary,
	withTemporaryLayer,
} from "./temporary-variables";
import { INITIAL_WORKBENCH, workbenchReducer } from "./workbench-reducer";

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

/** No script in these drafts: the runner is never called. */
const runner: ScriptRunner = {
	run: () => Promise.reject(new Error("no script expected")),
};
const signal = new AbortController().signal;

function send(url: string, layers: readonly ResolverLayer[] | undefined) {
	const draft = createRequestDraft({ url });
	return prepareSend(
		{
			draft,
			files: new Map(),
			signal,
			...(layers ? { variables: layers } : {}),
		},
		runner,
	);
}

const ENVIRONMENT: ResolverLayer[] = [
	{
		kind: "global",
		variables: scopeVariables([variable("host", "global.test")], []),
	},
	{
		kind: "environment",
		label: "Staging",
		variables: scopeVariables(
			[
				variable("host", "staging.test"),
				variable("token", null, { type: "secret", sharedHidden: true }),
			],
			[{ key: "host", value: "local.test" }],
		),
	},
];

const TEMP: TemporaryVariable[] = [{ key: "host", value: "temp.test" }];

describe("withTemporary", () => {
	it("adds, replaces and removes by trimmed name", () => {
		const added = withTemporary([], " id ", "1");
		expect(added).toEqual([{ key: "id", value: "1" }]);
		expect(withTemporary(added, "id", "2")).toEqual([
			{ key: "id", value: "2" },
		]);
		expect(withTemporary(added, "id", null)).toEqual([]);
	});

	it("returns the same list when nothing changes", () => {
		const list = [{ key: "id", value: "1" }];
		expect(withTemporary(list, "id", "1")).toBe(list);
		expect(withTemporary(list, "other", null)).toBe(list);
		expect(withTemporary(list, "  ", "x")).toBe(list);
	});
});

describe("temporary variables in a send", () => {
	it("override the environment's local value and every lower scope", async () => {
		const layers = withTemporaryLayer(ENVIRONMENT, null, TEMP);
		const ready = await send("https://{{host}}/users", layers);
		expect(ready.ok && ready.prepared.url).toBe("https://temp.test/users");
	});

	it("leave the layers as they are when the tab has none", () => {
		expect(withTemporaryLayer(ENVIRONMENT, null, [])).toBe(ENVIRONMENT);
		expect(withTemporaryLayer(undefined, null, [])).toBeUndefined();
	});

	it("sit above the collection variables when no layers were read", async () => {
		const context = {
			inheritedAuth: { type: "none" as const },
			preScripts: [],
			postScripts: [],
			variables: [{ key: "host", value: "collection.test" }],
		};
		const layers = withTemporaryLayer(undefined, context, TEMP);
		expect(layers?.map((layer) => layer.kind)).toEqual([
			"collection",
			"temporary",
		]);
		const ready = await send("https://{{host}}/", layers);
		expect(ready.ok && ready.prepared.url).toBe("https://temp.test/");
	});

	it("fill in a name the server would otherwise have to (withheld secret)", async () => {
		const layers = withTemporaryLayer(ENVIRONMENT, null, [
			{ key: "token", value: "mine" },
		]);
		const ready = await send("https://api.test/?t={{token}}", layers);
		expect(ready.ok && ready.prepared.url).toBe("https://api.test/?t=mine");
	});
});

describe("workbench reducer", () => {
	it("keeps temporary variables per tab and drops them with the tab", () => {
		const draft = createRequestDraft();
		let state = workbenchReducer(INITIAL_WORKBENCH, {
			type: "open",
			id: "t1",
			draft,
			files: new Map(),
			activate: true,
			redacted: false,
		});
		state = workbenchReducer(state, {
			type: "open",
			id: "t2",
			draft,
			files: new Map(),
			activate: true,
			redacted: false,
		});
		state = workbenchReducer(state, {
			type: "setTemporary",
			id: "t1",
			key: "token",
			value: "abc",
		});
		const tab = (id: string) => state.tabs.find((item) => item.id === id);
		expect(tab("t1")?.temporary).toEqual([{ key: "token", value: "abc" }]);
		expect(tab("t2")?.temporary).toEqual([]);
		state = workbenchReducer(state, { type: "close", id: "t1" });
		expect(tab("t1")).toBeUndefined();
	});
});
