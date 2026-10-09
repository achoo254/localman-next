import type { PreparedRequest } from "@localman/shared/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DirectOptions, directFetch } from "./direct-fetch";

const PREPARED: PreparedRequest = {
	method: "POST",
	url: "https://api.test/users",
	headers: [
		{ name: "Content-Type", value: "application/json" },
		{ name: "Cookie", value: "sid=1" },
	],
	body: { kind: "text", text: '{"a":1}' },
	secretsUsed: [],
	unresolved: [],
};

function options(overrides: Partial<DirectOptions> = {}): DirectOptions {
	return {
		timeoutMs: 1_000,
		followRedirects: true,
		addressSpace: null,
		signal: new AbortController().signal,
		...overrides,
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("directFetch", () => {
	it("sends without page cookies and reads the response like the proxy", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response('{"id":1}', {
					status: 201,
					statusText: "Created",
					headers: { "Content-Type": "application/json" },
				}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const outcome = await directFetch(PREPARED, options());
		if (outcome.kind !== "response") throw new Error(outcome.kind);
		expect(outcome.dropped).toEqual(["Cookie"]);
		expect(outcome.response).toMatchObject({
			status: 201,
			statusText: "Created",
			body: '{"id":1}',
			bodyEncoding: "utf8",
			size: 8,
			truncated: false,
			finalUrl: PREPARED.url,
		});
		expect(outcome.response.headers).toContainEqual({
			name: "content-type",
			value: "application/json",
		});
		const init = fetchMock.mock.calls[0]?.at(1);
		expect(init).toMatchObject({ credentials: "omit", mode: "cors" });
	});

	it("returns binary bodies as base64", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(new Uint8Array([0xff, 0x00, 0x01]))),
		);
		const outcome = await directFetch(PREPARED, options());
		expect(outcome).toMatchObject({
			kind: "response",
			response: { body: "/wAB", bodyEncoding: "base64", size: 3 },
		});
	});

	it("reports a refused fetch, a timeout and a cancel apart", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch");
			}),
		);
		expect(await directFetch(PREPARED, options())).toEqual({ kind: "blocked" });

		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: string, init?: RequestInit) =>
					new Promise((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () =>
							reject(new DOMException("aborted", "AbortError")),
						);
					}),
			),
		);
		const timedOut = directFetch(PREPARED, options({ timeoutMs: 500 }));
		await vi.advanceTimersByTimeAsync(500);
		expect(await timedOut).toEqual({ kind: "timeout" });

		const controller = new AbortController();
		const cancelled = directFetch(
			PREPARED,
			options({ signal: controller.signal }),
		);
		controller.abort();
		expect(await cancelled).toEqual({ kind: "cancelled" });
	});

	it("never calls a body that breaks off after the response blocked", async () => {
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("partial"));
				controller.error(new TypeError("network error"));
			},
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(body, { status: 200 })),
		);
		expect(await directFetch(PREPARED, options())).toEqual({
			kind: "interrupted",
		});
	});

	it("only counts a TypeError before any response as blocked", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new RangeError("unexpected");
			}),
		);
		expect(await directFetch(PREPARED, options())).toEqual({
			kind: "interrupted",
		});
	});
});
