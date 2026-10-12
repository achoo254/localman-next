import {
	type ClientResponse,
	createRequestDraft,
	emptyRequestBody,
} from "@localman/shared/api-client";
import type {
	ScriptRunInput,
	ScriptRunner,
} from "@localman/shared/api-client/script-sandbox";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../../../test/mock-fetch";
import { createProxySender } from "./proxy-sender";

const RESPONSE: ClientResponse = {
	status: 201,
	statusText: "Created",
	headers: [{ name: "Content-Type", value: "application/json" }],
	body: '{"id":1}',
	bodyEncoding: "utf8",
	size: 8,
	timings: { dns: 1, connect: 2, tls: 3, ttfb: 10, total: 12 },
	finalUrl: "https://api.test/users",
	truncated: false,
};

/** Runner that records its inputs; the pre script adds a header and a variable. */
function fakeRunner(): ScriptRunner & { inputs: ScriptRunInput[] } {
	const inputs: ScriptRunInput[] = [];
	return {
		inputs,
		async run(input) {
			inputs.push(input);
			const pre = input.phase === "pre";
			return {
				request: pre
					? {
							...input.request,
							headers: [
								...input.request.headers,
								{ name: "X-Pre", value: "{{id}}" },
							],
						}
					: input.request,
				globals: {},
				collectionVariables: {},
				environment: {},
				variables: pre ? { id: "42" } : { ...input.variables },
				tests: pre ? [] : [{ name: "ok", passed: true, error: null }],
				logs: [],
				logsTruncated: false,
				error: null,
			};
		},
	};
}

const signal = () => new AbortController().signal;

afterEach(() => vi.unstubAllGlobals());

describe("createProxySender", () => {
	it("runs the scripts around a proxy send and fills script variables", async () => {
		const { calls } = mockFetch({ "POST /api/v1/proxy": { body: RESPONSE } });
		const runner = fakeRunner();
		const draft = createRequestDraft({
			method: "POST",
			url: "https://api.test/users",
			auth: { type: "bearer", token: "t0k" },
			body: { ...emptyRequestBody(), type: "raw", raw: '{"a":1}' },
			scripts: {
				pre: "lm.variables.set('id', '42')",
				post: "lm.test('ok', () => {})",
			},
		});
		const settled = await createProxySender(runner)({
			draft,
			files: new Map(),
			signal: signal(),
		});

		expect(calls[0]?.body).toMatchObject({
			method: "POST",
			url: "https://api.test/users",
			headers: [
				{ name: "X-Pre", value: "42" },
				{ name: "Authorization", value: "Bearer t0k" },
				{ name: "Content-Type", value: "application/json" },
			],
			body: '{"a":1}',
			bodyType: "text",
			options: { followRedirects: true, timeoutMs: 30000, sendClientIp: true },
		});
		expect(runner.inputs.map((input) => input.phase)).toEqual(["pre", "post"]);
		expect(runner.inputs[1]).toMatchObject({
			phase: "post",
			variables: { id: "42" },
			response: RESPONSE,
		});
		expect(settled).toMatchObject({
			kind: "done",
			result: {
				route: "proxy",
				response: RESPONSE,
				request: { method: "POST", url: "https://api.test/users" },
				postScript: { tests: [{ name: "ok", passed: true }] },
			},
		});
	});

	it("never loads scripts when there are none, and sends binary files as base64", async () => {
		const { calls } = mockFetch({ "POST /api/v1/proxy": { body: RESPONSE } });
		const runner = fakeRunner();
		const file = new File([new Uint8Array([0, 255, 1])], "a.bin");
		const draft = createRequestDraft({
			method: "PUT",
			url: "https://api.test/blob",
			body: {
				...emptyRequestBody(),
				type: "binary",
				binary: { fileId: "f1", name: "a.bin", contentType: "", size: 3 },
			},
		});
		await createProxySender(runner)({
			draft,
			files: new Map([["f1", file]]),
			signal: signal(),
		});
		expect(runner.inputs).toEqual([]);
		expect(calls[0]?.body).toMatchObject({ body: "AP8B", bodyType: "base64" });
	});
});
