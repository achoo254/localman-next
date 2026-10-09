import { describe, expect, it } from "vitest";
import {
	type InterpolationContext,
	createInterpolator,
	interpolate,
	interpolateString,
} from "./variable-interpolation.js";

const ctx: InterpolationContext = {
	scopes: [
		{ name: "globals", variables: [{ key: "apiKey", value: "global-key" }] },
		{
			name: "env",
			variables: [
				{ key: "baseUrl", value: "https://api.example.com" },
				{ key: "token", value: "secret123", secret: true },
			],
		},
	],
};

describe("variable interpolation (ported)", () => {
	it("replaces env and global vars", () => {
		const result = interpolate("{{baseUrl}}/users", ctx);
		expect(result.value).toBe("https://api.example.com/users");
		expect(result.unresolved).toEqual([]);
	});

	it("a later scope overrides an earlier one", () => {
		const both: InterpolationContext = {
			scopes: [
				{ variables: [{ key: "x", value: "global" }] },
				{ variables: [{ key: "x", value: "env" }] },
			],
		};
		expect(interpolateString("{{x}}", both)).toBe("env");
	});

	it("leaves unresolved as-is and tracks them", () => {
		const result = interpolate("{{baseUrl}}/{{missing}}", ctx);
		expect(result.value).toBe("https://api.example.com/{{missing}}");
		expect(result.unresolved).toEqual(["missing"]);
	});

	it("resolves dynamic $guid", () => {
		const result = interpolate("id={{$guid}}", ctx);
		expect(result.value).toMatch(
			/^id=[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	});

	it("resolves dynamic $timestamp", () => {
		expect(interpolateString("t={{$timestamp}}", ctx)).toMatch(/^t=\d+$/);
	});
});

describe("variable interpolation", () => {
	it("an empty string value counts as resolved", () => {
		const empty: InterpolationContext = {
			scopes: [{ variables: [{ key: "blank", value: "" }] }],
		};
		expect(interpolate("a{{blank}}b", empty)).toEqual({
			value: "ab",
			unresolved: [],
			secrets: [],
		});
	});

	it("trims names and ignores `{{}}` and `{{ }}`", () => {
		const result = interpolate("{{ baseUrl }}/{{}}/{{ }}", ctx);
		expect(result.value).toBe("https://api.example.com/{{}}/{{ }}");
		expect(result.unresolved).toEqual([]);
	});

	it("treats extra braces as literal text", () => {
		expect(interpolateString("{{{apiKey}}}", ctx)).toBe("{global-key}");
	});

	it("is single pass: a value holding {{x}} is not expanded", () => {
		const nested: InterpolationContext = {
			scopes: [
				{
					variables: [
						{ key: "a", value: "{{b}}" },
						{ key: "b", value: "B" },
					],
				},
			],
		};
		expect(interpolateString("{{a}}", nested)).toBe("{{b}}");
	});

	it("keeps `$` patterns in values literal", () => {
		const dollar: InterpolationContext = {
			scopes: [{ variables: [{ key: "p", value: "$& $1 $$" }] }],
		};
		expect(interpolateString("[{{p}}]", dollar)).toBe("[$& $1 $$]");
	});

	it("skips disabled variables and falls back to a lower scope", () => {
		const scoped: InterpolationContext = {
			scopes: [
				{ variables: [{ key: "x", value: "global" }] },
				{ variables: [{ key: "x", value: "env", enabled: false }] },
			],
		};
		expect(interpolateString("{{x}}", scoped)).toBe("global");
	});

	it("reports unknown dynamic variables as unresolved", () => {
		const result = interpolate("{{$nope}}", ctx);
		expect(result.value).toBe("{{$nope}}");
		expect(result.unresolved).toEqual(["$nope"]);
	});

	it("works without any context", () => {
		expect(interpolate("{{x}}", undefined).unresolved).toEqual(["x"]);
	});
});

describe("secret flag", () => {
	it("reports the secret variables whose value was filled in", () => {
		const result = interpolate("Bearer {{token}} {{apiKey}}", ctx);
		expect(result.value).toBe("Bearer secret123 global-key");
		expect(result.secrets).toEqual(["token"]);
	});

	it("reports no secret when none is used", () => {
		expect(interpolate("{{baseUrl}}/{{apiKey}}", ctx).secrets).toEqual([]);
	});

	it("a non-secret override hides the secret below it", () => {
		const scoped: InterpolationContext = {
			scopes: [
				{ variables: [{ key: "token", value: "s", secret: true }] },
				{ variables: [{ key: "token", value: "plain" }] },
			],
		};
		expect(interpolate("{{token}}", scoped).secrets).toEqual([]);
	});

	it("accumulates secrets and unresolved names across calls", () => {
		const interpolator = createInterpolator(ctx);
		interpolator.apply("{{baseUrl}}");
		interpolator.apply("{{token}} {{token}} {{gone}}");
		interpolator.apply("{{gone}}");
		expect(interpolator.secretsUsed()).toEqual(["token"]);
		expect(interpolator.unresolved()).toEqual(["gone"]);
	});
});
