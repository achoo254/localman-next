import { vi } from "vitest";

export interface FetchCall {
	method: string;
	path: string;
	query: URLSearchParams;
	body: unknown;
	init: RequestInit | undefined;
}

export interface MockReply {
	status?: number;
	body?: unknown;
}

/** A reply, or a function of the call; return a Promise to hold the response. */
export type MockRoute =
	| MockReply
	| ((call: FetchCall) => MockReply | Promise<MockReply>);

/**
 * Stubs global fetch with routes keyed by "METHOD /path" (query ignored).
 * Unknown routes answer 404 so a missing mock fails loudly in assertions.
 */
export function mockFetch(routes: Record<string, MockRoute>) {
	const calls: FetchCall[] = [];
	const fetchMock = vi.fn(
		async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const url = new URL(String(input), window.location.origin);
			const method = init?.method ?? "GET";
			const body =
				typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
			const call = {
				method,
				path: url.pathname,
				query: url.searchParams,
				body,
				init,
			};
			calls.push(call);
			const route = routes[`${method} ${url.pathname}`];
			const reply: MockReply = route
				? typeof route === "function"
					? await route(call)
					: route
				: {
						status: 404,
						body: { error: { code: "NOT_FOUND", message: "no mock" } },
					};
			return new Response(
				reply.body === undefined ? null : JSON.stringify(reply.body),
				{
					status: reply.status ?? 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		},
	);
	vi.stubGlobal("fetch", fetchMock);
	return { fetchMock, calls };
}

export const UNAUTHENTICATED: MockReply = {
	status: 401,
	body: { error: { code: "UNAUTHENTICATED", message: "Chưa đăng nhập." } },
};
