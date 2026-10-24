import type {
	ClientResponse,
	KeptResponse,
	TabSource,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import {
	REFERENCE_KEYS_MAX,
	type ReferenceRequest,
	referenceExpression,
	referenceSuggestions,
} from "./response-suggestions";
import {
	dynamicVariableNames,
	suggestionsFor,
	variableClassifier,
} from "./variable-kinds";

const source = (nodeId: string): TabSource => ({ collectionId: "c1", nodeId });

function kept(body: string): KeptResponse {
	const response: ClientResponse = {
		status: 200,
		statusText: "OK",
		headers: [],
		body,
		bodyEncoding: "utf8",
		size: body.length,
		timings: { dns: null, connect: null, tls: null, ttfb: null, total: 1 },
		finalUrl: "https://api.test/",
		truncated: false,
	};
	return { response, at: 0 };
}

const LOG_IN: ReferenceRequest = { name: "Log in", source: source("login") };
const REQUESTS: ReferenceRequest[] = [
	LOG_IN,
	{ name: "List users", source: source("users") },
	{ name: "Current", source: source("current") },
];

describe("response reference suggestions", () => {
	it("quote the request name the way a reference parses it", () => {
		expect(referenceExpression("Log in", "$")).toBe('response "Log in" "$"');
		expect(referenceExpression('Say "hi"', "$.a")).toBe(
			`response 'Say "hi"' "$.a"`,
		);
		expect(referenceExpression(`Both "'"`, "$")).toBeNull();
	});

	it("offer each other request whole, then the keys of its kept JSON object", () => {
		const responses = new Map([
			["login", kept('{"token":"t-1","user":{"id":7},"two words":1}')],
			["users", kept("not json")],
		]);
		const items = referenceSuggestions(REQUESTS, source("current"), (s) =>
			responses.get(s.nodeId),
		);
		expect(items).toEqual([
			{
				expression: 'response "Log in" "$"',
				value: '{"token":"t-1","user":{"id":7},"two words":1}',
			},
			{ expression: 'response "Log in" "$.token"', value: "t-1" },
			{ expression: 'response "Log in" "$.user"', value: '{"id":7}' },
			{ expression: 'response "List users" "$"', value: null },
		]);
	});

	it("caps the keys offered per request", () => {
		const many = Object.fromEntries(
			Array.from({ length: 20 }, (_, i) => [`k${i}`, i]),
		);
		const items = referenceSuggestions([LOG_IN], null, () =>
			kept(JSON.stringify(many)),
		);
		expect(items).toHaveLength(1 + REFERENCE_KEYS_MAX);
	});

	it("join the list after the names, for any start of the word response", () => {
		const references = [{ expression: 'response "Log in" "$"', value: null }];
		const names = (query: string) =>
			suggestionsFor([], query, dynamicVariableNames(), references).map(
				(item) => item.name,
			);
		expect(names("res").at(-1)).toBe('response "Log in" "$"');
		expect(names("log")).toEqual(['response "Log in" "$"']);
		expect(names("zzz")).toEqual([]);
	});

	it("colour a reference to a request of the collection, flag any other", () => {
		const classify = variableClassifier([], [], new Set(["Log in"]));
		expect(classify('response "Log in" "$.token"')).toBe("reference");
		expect(classify('response "Gone" "$.token"')).toBe("undeclared");
		const outside = variableClassifier([], [], null);
		expect(outside('response "Log in" "$.token"')).toBe("undeclared");
	});
});
