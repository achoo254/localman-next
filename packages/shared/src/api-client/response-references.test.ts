import { describe, expect, it } from "vitest";
import type { ClientResponse } from "./response-model.js";
import {
	type KeptResponse,
	type ReferenceSources,
	ResponseReferenceError,
	findResponseReferences,
	parseResponseReference,
	resolveResponseReferences,
} from "./response-references.js";

const json = (value: unknown): ClientResponse => ({
	status: 200,
	statusText: "OK",
	headers: [],
	body: JSON.stringify(value),
	bodyEncoding: "utf8",
	size: 0,
	timings: { dns: null, connect: null, tls: null, ttfb: null, total: 1 },
	finalUrl: "https://api.test",
	truncated: false,
});

interface FakeRequest {
	name: string;
	/** References its own fields hold. */
	uses: string[];
	answer: () => unknown;
}

/**
 * Requests by name, kept responses and a clock; sending a request first
 * resolves what it references, as the API client does.
 */
function world(requests: FakeRequest[], start = 1_000_000) {
	let now = start;
	const kept = new Map<string, KeptResponse>();
	const sent: string[] = [];
	const sources: ReferenceSources<FakeRequest> = {
		find: async (name) => requests.find((r) => r.name === name) ?? null,
		idOf: (r) => r.name,
		kept: (r) => kept.get(r.name),
		now: () => now,
		send: async (r, chain) => {
			await resolveResponseReferences(
				findResponseReferences(r.uses),
				sources,
				chain,
			);
			sent.push(r.name);
			const response = json(r.answer());
			kept.set(r.name, { response, at: now });
			return response;
		},
	};
	const tick = (ms: number): void => {
		now += ms;
	};
	return { sources, sent, tick };
}

describe("parseResponseReference", () => {
	it("reads the request, the path and an optional TTL", () => {
		expect(parseResponseReference('response "Log in" "$.token"')).toMatchObject(
			{
				requestName: "Log in",
				path: "$.token",
				ttlSeconds: 300,
			},
		);
		expect(
			parseResponseReference("response 'Log in' '$.data[0].id' 60"),
		).toMatchObject({
			path: "$.data[0].id",
			ttlSeconds: 60,
		});
		expect(parseResponseReference("baseUrl")).toBeNull();
		expect(parseResponseReference('response "" "$.x"')).toBeNull();
	});

	it("finds each reference once among the texts of a request", () => {
		const found = findResponseReferences([
			'{{baseUrl}}/me?t={{response "Log in" "$.token"}}',
			'Bearer {{response "Log in" "$.token"}}',
		]);
		expect(found.map((r) => r.expression)).toEqual([
			'response "Log in" "$.token"',
		]);
	});
});

describe("resolveResponseReferences", () => {
	const chain: FakeRequest[] = [
		{ name: "Log in", uses: [], answer: () => ({ token: "t-1" }) },
		{
			name: "Me",
			uses: ['{{response "Log in" "$.token"}}'],
			answer: () => ({ id: 42 }),
		},
		{
			name: "Orders",
			uses: ['{{response "Me" "$.id"}}'],
			answer: () => ({ items: [] }),
		},
	];

	it("chains three requests, sending each source once", async () => {
		const { sources, sent } = world(chain);
		const refs = findResponseReferences(['{{response "Me" "$.id"}}']);
		const values = await resolveResponseReferences(refs, sources, ["Orders"]);
		expect(values.get('response "Me" "$.id"')).toBe("42");
		expect(sent).toEqual(["Log in", "Me"]);
	});

	it("uses a kept response within its TTL and sends again once it is older", async () => {
		const { sources, sent, tick } = world(chain);
		const refs = findResponseReferences(['{{response "Log in" "$.token" 60}}']);
		await resolveResponseReferences(refs, sources, ["Me"]);
		tick(30_000);
		await resolveResponseReferences(refs, sources, ["Me"]);
		expect(sent).toEqual(["Log in"]);
		tick(31_000);
		await resolveResponseReferences(refs, sources, ["Me"]);
		expect(sent).toEqual(["Log in", "Log in"]);
	});

	it("reports a loop instead of sending forever", async () => {
		const loop: FakeRequest[] = [
			{ name: "A", uses: ['{{response "B" "$.x"}}'], answer: () => ({ x: 1 }) },
			{ name: "B", uses: ['{{response "A" "$.x"}}'], answer: () => ({ x: 2 }) },
		];
		const { sources } = world(loop);
		const refs = findResponseReferences(['{{response "B" "$.x"}}']);
		await expect(
			resolveResponseReferences(refs, sources, ["A"]),
		).rejects.toMatchObject({
			code: "REFERENCE_LOOP",
		});
	});

	it("names what is wrong: no such request, not JSON, missing path", async () => {
		const { sources } = world([
			{ name: "Text", uses: [], answer: () => "plain" },
			{ name: "Obj", uses: [], answer: () => ({ a: 1 }) },
		]);
		const codeOf = async (text: string) => {
			try {
				await resolveResponseReferences(
					findResponseReferences([text]),
					sources,
					["X"],
				);
				return "ok";
			} catch (error) {
				return error instanceof ResponseReferenceError ? error.code : "other";
			}
		};
		expect(await codeOf('{{response "Nope" "$.a"}}')).toBe(
			"REFERENCE_REQUEST_NOT_FOUND",
		);
		expect(await codeOf('{{response "Obj" "$.b"}}')).toBe(
			"REFERENCE_PATH_MISSING",
		);
		expect(await codeOf('{{response "Obj" "a"}}')).toBe(
			"REFERENCE_PATH_INVALID",
		);
		expect(await codeOf('{{response "Text" "$.a"}}')).toBe(
			"REFERENCE_PATH_MISSING",
		);
	});
});
