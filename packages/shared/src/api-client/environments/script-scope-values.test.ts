import { describe, expect, it } from "vitest";
import {
	emptyScriptScopes,
	hasScriptScopeChanges,
	scriptScopeChanges,
	scriptScopeValues,
	withScriptScopes,
} from "./script-scope-values.js";
import type { ResolverLayer, ScopeVariable } from "./variable-resolver.js";

function variable(
	key: string,
	value: string | null,
	extra: Partial<ScopeVariable> = {},
): ScopeVariable {
	return {
		key,
		value,
		enabled: true,
		secret: false,
		source: "shared",
		withheld: false,
		...extra,
	};
}

describe("scriptScopeValues", () => {
	it("keeps usable values per scope and skips the rest", () => {
		const layers: ResolverLayer[] = [
			{ kind: "global", variables: [variable("host", "g.example")] },
			{
				kind: "collection",
				variables: [
					variable("off", "x", { enabled: false }),
					variable("unset", null, { source: "none" }),
				],
			},
			{
				kind: "environment",
				variables: [
					variable("token", null, { secret: true, withheld: true }),
					variable("host", "local.example", { source: "local" }),
				],
			},
			{ kind: "temporary", variables: [variable("tmp", "t")] },
		];
		expect(scriptScopeValues(layers)).toEqual({
			globals: { host: "g.example" },
			collectionVariables: {},
			environment: { host: "local.example" },
		});
	});
});

describe("scriptScopeChanges", () => {
	it("turns sets into local values and removals into resets", () => {
		const before = {
			...emptyScriptScopes(),
			environment: { host: "a", keep: "k", gone: "g" },
		};
		const after = {
			...emptyScriptScopes(),
			environment: { host: "b", keep: "k", fresh: "f" },
			globals: { token: "t" },
		};
		const changes = scriptScopeChanges(before, after);
		expect(changes).toEqual({
			globals: [{ key: "token", value: "t" }],
			collectionVariables: [],
			environment: [
				{ key: "host", value: "b" },
				{ key: "fresh", value: "f" },
				{ key: "gone", value: null },
			],
		});
		expect(hasScriptScopeChanges(changes)).toBe(true);
	});

	it("reports nothing for an untouched run", () => {
		const scopes = { ...emptyScriptScopes(), globals: { a: "1" } };
		expect(
			hasScriptScopeChanges(scriptScopeChanges(scopes, { ...scopes })),
		).toBe(false);
	});
});

describe("withScriptScopes", () => {
	it("applies sets and unsets of the scripts to the layers of a send", () => {
		const layers: ResolverLayer[] = [
			{ kind: "global", variables: [variable("host", "g.example")] },
			{
				kind: "environment",
				variables: [
					variable("host", "e.example"),
					variable("off", "x", { enabled: false }),
				],
			},
		];
		const scopes = {
			...emptyScriptScopes(),
			globals: { host: "g.example" },
			environment: { token: "t" },
		};
		const [globals, environment] = withScriptScopes(layers, scopes);
		expect(globals?.variables.map((v) => [v.key, v.value])).toEqual([
			["host", "g.example"],
		]);
		// host was unset in the environment, off stays (disabled), token is new.
		expect(environment?.variables.map((v) => [v.key, v.value])).toEqual([
			["off", "x"],
			["token", "t"],
		]);
	});
});
