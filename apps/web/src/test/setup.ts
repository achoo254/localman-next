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

/*
 * jsdom has no PointerEvent; without it Testing Library's pointer events
 * lose their coordinates. Pointer events are mouse events plus pointer
 * fields the components do not read.
 */
if (typeof globalThis.PointerEvent === "undefined") {
	class TestPointerEvent extends MouseEvent {}
	globalThis.PointerEvent = TestPointerEvent as typeof PointerEvent;
}

/*
 * CodeMirror measures text through Range geometry, which jsdom does not
 * implement. Empty rectangles are enough: tests never assert layout.
 */
const emptyRect = (): DOMRect => new DOMRect(0, 0, 0, 0);
Range.prototype.getBoundingClientRect = emptyRect;
Range.prototype.getClientRects = () => {
	const rects: DOMRect[] = [];
	return Object.assign(rects, {
		item: (index: number) => rects[index] ?? null,
	}) as unknown as DOMRectList;
};

afterEach(() => {
	cleanup();
	// The login redirect-loop counter lives here; keep tests independent.
	window.sessionStorage.clear();
});
