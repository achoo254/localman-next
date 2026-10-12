import type { ResolverLayer, ScopeVariable } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import {
	dynamicVariableNames,
	suggestionsFor,
	variableClassifier,
} from "./variable-kinds";

const value = (
	key: string,
	text: string | null,
	extra: Partial<ScopeVariable> = {},
): ScopeVariable => ({
	key,
	value: text,
	enabled: true,
	secret: false,
	source: text === null ? "none" : "shared",
	withheld: false,
	...extra,
});

const LAYERS: ResolverLayer[] = [
	{ kind: "global", variables: [value("host", "g.test"), value("token", "g")] },
	{
		kind: "environment",
		label: "Staging",
		variables: [
			value("token", "e"),
			value("off", "x", { enabled: false }),
			value("unshared", null),
			value("hidden", null, { secret: true, withheld: true }),
		],
	},
	{ kind: "temporary", variables: [value("tmp", "t")] },
];

describe("variableClassifier", () => {
	const classify = variableClassifier(LAYERS, ["$guid", "$randomEmail"]);

	it("marks names some enabled scope resolves", () => {
		expect(classify("host")).toBe("resolved");
		expect(classify(" token ")).toBe("resolved");
		expect(classify("tmp")).toBe("resolved");
	});

	it("marks a secret hidden from the caller as withheld: a send stops on it", () => {
		expect(classify("hidden")).toBe("withheld");
	});

	it("marks missing, disabled and valueless names undeclared", () => {
		expect(classify("missing")).toBe("undeclared");
		expect(classify("off")).toBe("undeclared");
		expect(classify("unshared")).toBe("undeclared");
	});

	it("knows dynamic names and treats unknown $names as undeclared", () => {
		expect(classify("$guid")).toBe("dynamic");
		expect(classify("$nope")).toBe("undeclared");
	});
});

describe("dynamicVariableNames", () => {
	it("lists names with their $", () => {
		const names = dynamicVariableNames();
		expect(names).toContain("$guid");
		expect(names.every((name) => name.startsWith("$"))).toBe(true);
	});
});

describe("suggestionsFor", () => {
	const dynamic = ["$guid", "$timestamp"];

	it("lists declared names with their winning scope, then dynamic ones", () => {
		const items = suggestionsFor(LAYERS, "", dynamic);
		expect(items.map((item) => [item.name, item.scope])).toEqual([
			["hidden", "environment"],
			["host", "global"],
			["tmp", "temporary"],
			["token", "environment"],
			["$guid", "dynamic"],
			["$timestamp", "dynamic"],
		]);
	});

	it("filters case-insensitively, prefix matches first", () => {
		const items = suggestionsFor(LAYERS, "T", dynamic);
		expect(items.map((item) => item.name)).toEqual([
			"tmp",
			"token",
			"host",
			"$timestamp",
		]);
	});

	it("matches dynamic names with or without the $", () => {
		expect(suggestionsFor(LAYERS, "$ti", dynamic).map((i) => i.name)).toEqual([
			"$timestamp",
		]);
		expect(suggestionsFor(LAYERS, "gui", dynamic).map((i) => i.name)).toEqual([
			"$guid",
		]);
	});
});
