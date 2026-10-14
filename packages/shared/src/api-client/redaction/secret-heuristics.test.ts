import { describe, expect, it } from "vitest";
import type { CollectionTree } from "../import/imported-collection.js";
import { createRequestDraft, emptyRequestBody } from "../request-model.js";
import { findSecretLikeValues, looksLikeSecret } from "./secret-heuristics.js";

describe("looksLikeSecret", () => {
	it.each([
		"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
		"sk_live_51HxYzAbCdEf",
		"sk_test_4eC39HqLyjWDarjtT1zdp7dc",
		"pk_live_abcdefgh12",
		"ghp_abcdefghijklmnopqrstuvwxyz0123456789",
		"github_pat_11ABCDEFG0123456789abcdef",
		"xoxb-1234567890-abcdefghij",
		"AKIAIOSFODNN7EXAMPLE",
		"AIzaSyA-1234567890abcdefghijklmnopqrstu",
		"Bearer Zx8kQ2mN7pL4vR9tY3wB6cH1jF5dS0aG",
		'pm.environment.set("key", "sk_live_51HxYzAbCdEf");',
	])("flags %s", (value) => {
		expect(looksLikeSecret(value)).toBe(true);
	});

	it.each([
		"123e4567-e89b-12d3-a456-426614174000",
		"https://api.example.com/v1/users/12345?page=2",
		"The quick brown fox jumps over the lazy dog",
		"1234567890123456789012345678",
		"application/json",
		"{{someVeryLongVariableNameForTokens}}",
		"Bearer {{token}}",
		"",
	])("leaves %s", (value) => {
		expect(looksLikeSecret(value)).toBe(false);
	});
});

describe("findSecretLikeValues", () => {
	const draft = createRequestDraft({
		url: "https://api.test/hooks/Zx8kQ2mN7pL4vR9tY3wB6cH1jF5dS0aG",
		headers: [
			{
				id: "h1",
				key: "X-Custom",
				value: "sk_live_51HxYzAbCdEf",
				enabled: true,
			},
			{
				id: "h2",
				key: "Authorization",
				value: "sk_live_51HxYzAbCdEf",
				enabled: true,
			},
		],
		body: {
			...emptyRequestBody(),
			type: "raw",
			raw: '{"key":"AKIAIOSFODNN7EXAMPLE"}',
		},
		scripts: { pre: "", post: "" },
	});
	const tree: CollectionTree = {
		name: "C",
		description: "",
		auth: { type: "none" },
		variables: [
			{ key: "apiKey", value: "sk_live_51HxYzAbCdEf" },
			{ key: "marked", value: "sk_live_51HxYzAbCdEf", secret: true },
			{ key: "baseUrl", value: "https://api.test" },
		],
		scripts: {
			pre: 'const t = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";',
			post: "",
		},
		tags: [],
		status: null,
		items: [
			{
				kind: "folder",
				id: "f",
				name: "hooks",
				description: "",
				auth: { type: "inherit" },
				scripts: { pre: "", post: "" },
				items: [
					{
						kind: "request",
						id: "r",
						name: "Fire",
						description: "",
						draft,
						examples: [
							{
								id: "e",
								name: "ok",
								request: draft,
								response: {
									status: 200,
									statusText: "OK",
									headers: [
										{
											id: "x",
											key: "X-Request-Id",
											value: "AKIAIOSFODNN7EXAMPLE",
											enabled: true,
										},
									],
									body: "",
									bodyLanguage: "json",
								},
							},
						],
					},
				],
			},
		],
	};

	it("lists places, never values, and skips secret variables and credential names", () => {
		const found = findSecretLikeValues(tree, {
			name: "Env",
			variables: [{ key: "stripe", value: "sk_test_4eC39HqLyjWDarjtT1zdp7dc" }],
		});
		expect(found).toEqual([
			{ where: "collectionVariable", path: [], key: "apiKey" },
			{ where: "environmentVariable", path: [], key: "stripe" },
			{ where: "script", path: [], key: "pre" },
			{ where: "url", path: ["hooks", "Fire"], key: "url" },
			{ where: "requestHeader", path: ["hooks", "Fire"], key: "X-Custom" },
			{ where: "requestBody", path: ["hooks", "Fire"], key: "body" },
			{ where: "url", path: ["hooks", "Fire", "ok"], key: "url" },
			{
				where: "requestHeader",
				path: ["hooks", "Fire", "ok"],
				key: "X-Custom",
			},
			{ where: "requestBody", path: ["hooks", "Fire", "ok"], key: "body" },
			{
				where: "exampleHeader",
				path: ["hooks", "Fire", "ok"],
				key: "X-Request-Id",
			},
		]);
		expect(JSON.stringify(found)).not.toContain("sk_live");
	});
});

describe("findSecretLikeValues on what redaction keeps", () => {
	const base: CollectionTree = {
		name: "C",
		description: "",
		auth: { type: "none" },
		variables: [{ key: "apiKey", value: "short" }],
		scripts: { pre: "", post: "" },
		tags: [],
		status: null,
		items: [
			{
				kind: "request",
				id: "r",
				name: "Callback",
				description: "",
				draft: createRequestDraft({
					url: "https://app.test/cb#state=Zx8kQ2mN7pL4vR9tY3wB6cH1jF5dS0aG",
				}),
				examples: [],
			},
		],
	};

	it("warns on plain variables named like credentials and on fragment values", () => {
		expect(findSecretLikeValues(base)).toEqual([
			{ where: "collectionVariable", path: [], key: "apiKey" },
			{ where: "url", path: ["Callback"], key: "url" },
		]);
	});
});
