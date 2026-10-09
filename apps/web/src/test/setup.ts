import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/*
 * React Router's data router builds a `Request` (Node/undici) with an
 * AbortSignal from jsdom, which undici rejects. Tests never abort
 * navigations, so the test-only Request drops the foreign signal.
 */
const NodeRequest = globalThis.Request;
class TestRequest extends NodeRequest {
	constructor(input: RequestInfo | URL, init?: RequestInit) {
		const { signal: _signal, ...rest } = init ?? {};
		super(input, rest);
	}
}
globalThis.Request = TestRequest;

afterEach(() => {
	cleanup();
	// The login redirect-loop counter lives here; keep tests independent.
	window.sessionStorage.clear();
});
