import { describe, expect, it } from "vitest";
import type { VariableScopeKind, VariableView } from "./environment-model.js";
import {
	type ResolverLayer,
	entryVariables,
	interpolationScope,
	resolveVariable,
	scopeVariables,
	withheldNames,
} from "./variable-resolver.js";

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

const layer = (
	kind: VariableScopeKind,
	variables: VariableView[],
	local: Record<string, string> = {},
): ResolverLayer => ({
	kind,
	label: kind,
	variables: scopeVariables(
		variables,
		Object.entries(local).map(([key, value]) => ({ key, value })),
	),
});

describe("resolveVariable", () => {
	it.each<{
		name: string;
		variable?: string;
		layers: ResolverLayer[];
		value: string | null;
		kind: VariableScopeKind | null;
		source?: "local" | "shared";
		overridden: string[];
	}>([
		{
			name: "global < collection < environment < temporary",
			layers: [
				layer("global", [variable("v", "g")]),
				layer("collection", [variable("v", "c")]),
				layer("environment", [variable("v", "e")]),
				layer("temporary", [variable("v", "t")]),
			],
			value: "t",
			kind: "temporary",
			overridden: ["environment", "collection", "global"],
		},
		{
			name: "a local value overrides the shared one of its scope",
			layers: [layer("environment", [variable("v", "shared")], { v: "mine" })],
			value: "mine",
			kind: "environment",
			source: "local",
			overridden: [],
		},
		{
			name: "a local value of a lower scope loses to a higher shared one",
			layers: [
				layer("global", [variable("v", "g")], { v: "mine" }),
				layer("environment", [variable("v", "e")]),
			],
			value: "e",
			kind: "environment",
			source: "shared",
			overridden: ["global"],
		},
		{
			name: "a disabled variable is skipped and listed last",
			layers: [
				layer("global", [variable("v", "g")]),
				layer("environment", [variable("v", "e", { enabled: false })]),
			],
			value: "g",
			kind: "global",
			overridden: ["environment"],
		},
		{
			name: "a disabled variable with a local value stays disabled",
			layers: [
				layer("environment", [variable("v", "e", { enabled: false })], {
					v: "mine",
				}),
			],
			value: null,
			kind: null,
			overridden: ["environment"],
		},
		{
			name: "no shared and no local value: the lower scope wins",
			layers: [
				layer("global", [variable("v", "g")]),
				layer("environment", [variable("v", null)]),
			],
			value: "g",
			kind: "global",
			overridden: ["environment"],
		},
		{
			name: "no shared value but a local one",
			layers: [layer("environment", [variable("v", null)], { v: "mine" })],
			value: "mine",
			kind: "environment",
			source: "local",
			overridden: [],
		},
		{
			name: "a name nobody declares",
			layers: [layer("global", [variable("other", "x")])],
			value: null,
			kind: null,
			overridden: [],
		},
		{
			name: "a local value a script set without a definition",
			variable: "token",
			layers: [layer("environment", [], { token: "abc" })],
			value: "abc",
			kind: "environment",
			source: "local",
			overridden: [],
		},
	])(
		"$name",
		({ variable: name = "v", layers, value, kind, source, overridden }) => {
			const { winner, overridden: lower } = resolveVariable(name, layers);
			expect(winner?.value ?? null).toBe(value);
			expect(winner?.kind ?? null).toBe(kind);
			if (source) expect(winner?.source).toBe(source);
			expect(lower.map((candidate) => candidate.kind)).toEqual(overridden);
		},
	);
});

describe("withheld secrets", () => {
	const withheld = variable("token", null, {
		type: "secret",
		sharedHidden: true,
	});

	it("win over lower scopes and stay out of interpolation", () => {
		const layers = [
			layer("global", [variable("token", "global-token")]),
			layer("environment", [withheld, variable("host", "api.test")]),
		];
		expect(resolveVariable("token", layers).winner).toMatchObject({
			kind: "environment",
			withheld: true,
			value: null,
		});
		expect(withheldNames(layers)).toEqual(["token"]);
		expect(interpolationScope(layers).variables).toEqual([
			{ key: "host", value: "api.test", secret: false },
		]);
	});

	it("give way to the caller's own local value", () => {
		const layers = [layer("environment", [withheld], { token: "mine" })];
		expect(withheldNames(layers)).toEqual([]);
		expect(interpolationScope(layers).variables).toEqual([
			{ key: "token", value: "mine", secret: true },
		]);
	});

	it("give way to a higher scope", () => {
		const layers = [
			layer("environment", [withheld]),
			layer("temporary", [variable("token", "temp")]),
		];
		expect(withheldNames(layers)).toEqual([]);
		expect(resolveVariable("token", layers).winner?.value).toBe("temp");
	});
});

describe("entryVariables", () => {
	it("reads collection variables with the caller's local values", () => {
		const scope = entryVariables(
			[
				{ key: " baseUrl ", value: "https://shared.test" },
				{ key: "key", value: "s3cret", secret: true, enabled: false },
			],
			[{ key: "baseUrl", value: "http://localhost:3000" }],
		);
		expect(scope).toEqual([
			{
				key: "baseUrl",
				value: "http://localhost:3000",
				enabled: true,
				secret: false,
				source: "local",
				withheld: false,
			},
			{
				key: "key",
				value: "s3cret",
				enabled: false,
				secret: true,
				source: "shared",
				withheld: false,
			},
		]);
	});
});
