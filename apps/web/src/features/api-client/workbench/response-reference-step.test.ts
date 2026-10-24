import {
	type ApiRequestDraft,
	type ClientResponse,
	createRequestDraft,
} from "@localman/shared/api-client";
import { afterEach, describe, expect, it } from "vitest";
import { forgetKeptResponses, keepResponse } from "./kept-responses";
import {
	type NamedRequest,
	type ReferenceSteps,
	referenceScope,
} from "./response-reference-step";

afterEach(() => forgetKeptResponses());

const response = (body: unknown): ClientResponse => ({
	status: 200,
	statusText: "OK",
	headers: [],
	body: JSON.stringify(body),
	bodyEncoding: "utf8",
	size: 0,
	timings: { dns: null, connect: null, tls: null, ttfb: null, total: 1 },
	finalUrl: "https://api.test",
	truncated: false,
});

const request = (
	nodeId: string,
	draft: Partial<ApiRequestDraft> = {},
): NamedRequest => ({
	source: { collectionId: "c1", nodeId },
	draft: createRequestDraft({ url: "https://api.test", ...draft }),
});

/** Requests by name; sending one answers with `answers[name]`. */
function steps(
	requests: Record<string, NamedRequest>,
	answers: Record<string, unknown>,
) {
	const sent: string[] = [];
	const value: ReferenceSteps = {
		find: async (_collectionId, name) => requests[name] ?? null,
		send: async (named) => {
			const name =
				Object.keys(requests).find((key) => requests[key] === named) ?? "";
			sent.push(name);
			return response(answers[name]);
		},
	};
	return { steps: value, sent };
}

const me = (url: string) => createRequestDraft({ url, headers: [] });

describe("referenceScope", () => {
	it("needs nothing for a request without references", async () => {
		const { steps: s, sent } = steps({}, {});
		const out = await referenceScope(me("https://api.test/me"), undefined, s);
		expect(out).toEqual({ ok: true, scope: null });
		expect(sent).toEqual([]);
	});

	it("sends the source first, then keeps its response for the next send", async () => {
		const login = request("n-login");
		const { steps: s, sent } = steps(
			{ "Log in": login },
			{ "Log in": { token: "t-1" } },
		);
		const draft = me('https://api.test/me?t={{response "Log in" "$.token"}}');
		const self = { collectionId: "c1", nodeId: "n-me" };
		const first = await referenceScope(draft, self, s);
		expect(first).toEqual({
			ok: true,
			scope: {
				variables: [{ key: 'response "Log in" "$.token"', value: "t-1" }],
			},
		});
		await referenceScope(draft, self, s);
		expect(sent).toEqual(["Log in"]);
	});

	it("uses a response the user already got by sending the source", async () => {
		const login = request("n-login");
		keepResponse(login.source, response({ token: "kept" }));
		const { steps: s, sent } = steps({ "Log in": login }, {});
		const out = await referenceScope(
			me('{{response "Log in" "$.token"}}'),
			{ collectionId: "c1", nodeId: "n-me" },
			s,
		);
		expect(out.ok && out.scope?.variables[0]?.value).toBe("kept");
		expect(sent).toEqual([]);
	});

	it("refuses references outside a collection and names a missing request", async () => {
		const { steps: s } = steps({}, {});
		const outside = await referenceScope(
			me('{{response "A" "$.x"}}'),
			undefined,
			s,
		);
		expect(outside).toMatchObject({
			ok: false,
			code: "REFERENCE_OUTSIDE_COLLECTION",
		});
		const missing = await referenceScope(
			me('{{response "A" "$.x"}}'),
			{ collectionId: "c1", nodeId: "n-me" },
			s,
		);
		expect(missing).toMatchObject({
			ok: false,
			code: "REFERENCE_REQUEST_NOT_FOUND",
		});
	});

	it("reports a request that needs its own response", async () => {
		const self = request("n-me", { url: '{{response "Me" "$.id"}}' });
		const { steps: s } = steps({ Me: self }, { Me: { id: 1 } });
		const out = await referenceScope(self.draft, self.source, s);
		expect(out).toMatchObject({ ok: false, code: "REFERENCE_LOOP" });
	});

	it("keeps the code of a failure in a source's own references", async () => {
		const a = request("n-a", { url: '{{response "Gone" "$.x"}}' });
		const { steps: s } = steps({ A: a }, {});
		const out = await referenceScope(
			me('{{response "A" "$.x"}}'),
			{ collectionId: "c1", nodeId: "n-me" },
			s,
		);
		expect(out).toMatchObject({
			ok: false,
			code: "REFERENCE_REQUEST_NOT_FOUND",
		});
	});
});
