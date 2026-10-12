import { describe, expect, it } from "vitest";
import {
	ENVIRONMENT_VARIABLES_MAX,
	type SharedVariable,
	VARIABLE_VALUE_MAX,
} from "./environment-model.js";
import {
	importedSharedValue,
	parsePostmanEnvironment,
	postmanEnvironmentFileName,
	toPostmanEnvironment,
} from "./postman-environment.js";

/** Shaped like a file Postman writes from "Export" on an environment. */
const POSTMAN_EXPORT = {
	id: "5f0c7c3a-9d2e-4a61-8f3b-2a1d6e9b7c40",
	name: "Staging",
	values: [
		{
			key: "baseUrl",
			value: "https://stg.example",
			type: "default",
			enabled: true,
		},
		{ key: "apiKey", value: "sk_live_123", type: "secret", enabled: true },
		{ key: "legacyFlag", value: "on", type: "text", enabled: true },
		{
			key: "oldHost",
			value: "http://old.example",
			type: "any",
			enabled: false,
		},
		{ key: "retries", value: 3, enabled: true },
	],
	_postman_variable_scope: "environment",
	_postman_exported_at: "2026-09-30T08:15:42.117Z",
	_postman_exported_using: "Postman/11.14.0",
};

const variable = (
	key: string,
	sharedValue: string | null,
	extra: Partial<SharedVariable> = {},
): SharedVariable => ({
	id: key,
	key,
	type: "default",
	enabled: true,
	description: `about ${key}`,
	sharedValue,
	...extra,
});

/** A value as both sides of the codec write it. */
const row = (key: string, value: string, type = "default", enabled = true) => ({
	key,
	value,
	type,
	enabled,
});

describe("parsePostmanEnvironment", () => {
	it("reads a Postman export, mapping legacy types to default", () => {
		const parsed = parsePostmanEnvironment(POSTMAN_EXPORT);
		expect(parsed).toEqual({
			ok: true,
			name: "Staging",
			variables: [
				row("baseUrl", "https://stg.example"),
				row("apiKey", "sk_live_123", "secret"),
				row("legacyFlag", "on"),
				row("oldHost", "http://old.example", "default", false),
				row("retries", "3"),
			],
		});
	});

	it("accepts a file without a name or values' optional fields", () => {
		expect(parsePostmanEnvironment({ values: [{ key: " a " }] })).toEqual({
			ok: true,
			name: null,
			variables: [row("a", "")],
		});
	});
});

describe("toPostmanEnvironment", () => {
	const exportedAt = new Date("2026-10-12T07:00:00.000Z");

	it("writes shared values only, secrets blank, disabled ones kept", () => {
		const file = toPostmanEnvironment(
			{
				id: "env1",
				name: "Staging",
				variables: [
					variable("baseUrl", "https://stg.example"),
					variable("apiKey", "sk_live_123", { type: "secret" }),
					variable("unshared", null),
					variable("off", "1", { enabled: false }),
				],
			},
			exportedAt,
		);
		expect(file).toEqual({
			id: "env1",
			name: "Staging",
			values: [
				row("baseUrl", "https://stg.example"),
				row("apiKey", "", "secret"),
				row("unshared", ""),
				row("off", "1", "default", false),
			],
			_postman_variable_scope: "environment",
			_postman_exported_at: "2026-10-12T07:00:00.000Z",
			_postman_exported_using: "Localman",
		});
		expect(JSON.stringify(file)).not.toContain("sk_live_123");
		expect(JSON.stringify(file)).not.toContain("about");
	});

	it("round-trips a Postman export (secret values aside)", () => {
		const first = parsePostmanEnvironment(POSTMAN_EXPORT);
		if (!first.ok) throw new Error(first.issue);
		const file = toPostmanEnvironment(
			{
				id: "env1",
				name: first.name ?? "",
				variables: first.variables.map((v) =>
					variable(v.key, v.value, { type: v.type, enabled: v.enabled }),
				),
			},
			exportedAt,
		);
		const again = parsePostmanEnvironment(JSON.parse(JSON.stringify(file)));
		expect(again).toEqual({
			...first,
			variables: first.variables.map((v) =>
				v.type === "secret" ? { ...v, value: "" } : v,
			),
		});
	});
});

describe("importedSharedValue", () => {
	it("keeps a blank value unshared, whatever its type", () => {
		const base = { key: "k", enabled: true } as const;
		expect(importedSharedValue({ ...base, value: "", type: "default" })).toBe(
			null,
		);
		expect(importedSharedValue({ ...base, value: "", type: "secret" })).toBe(
			null,
		);
		expect(importedSharedValue({ ...base, value: "1", type: "default" })).toBe(
			"1",
		);
	});
});

describe("postmanEnvironmentFileName", () => {
	it("names the file like Postman and drops unsafe characters", () => {
		expect(postmanEnvironmentFileName("Staging")).toBe(
			"Staging.postman_environment.json",
		);
		expect(postmanEnvironmentFileName('a/b:c*"d')).toBe(
			"a_b_c__d.postman_environment.json",
		);
		expect(postmanEnvironmentFileName("  ")).toBe(
			"environment.postman_environment.json",
		);
	});
});
