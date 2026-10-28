import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

/*
 * GitHub's shared runners can take longer than Testing Library's default
 * second to show UI that appears after a request or a timer. On CI (CI is
 * set there) findBy* and waitFor wait up to 5 s; what they assert is the
 * same, they only wait longer before failing. Windows gets the same budget:
 * the first import of a lazy route transforms for seconds there.
 */
const slowHost = Boolean(process.env.CI) || process.platform === "win32";
configure({ asyncUtilTimeout: slowHost ? 5_000 : 1_000 });

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
 * Tests of Node-only code (Vite plugins) opt into `@vitest-environment node`;
 * the DOM shims below and the sessionStorage reset only apply under jsdom.
 */
const hasDom = typeof document !== "undefined";

if (hasDom) {
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
}

afterEach(() => {
	cleanup();
	if (!hasDom) return;
	// The login redirect-loop counter lives here; keep tests independent.
	window.sessionStorage.clear();
	// The shared language and theme choices (@achoo254/app-shell) live in
	// cookies, which jsdom keeps for the whole file.
	for (const name of ["hd_lang", "hd_theme"]) {
		document.cookie = `${name}=; Max-Age=0; Path=/`;
	}
});
