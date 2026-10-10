import { describe, expect, it } from "vitest";
import { ZOOM_MAX, ZOOM_MIN, fitScale, scrollForZoom } from "./canvas-zoom";

describe("fitScale", () => {
	it("scales a big tree down to fit the tighter side", () => {
		expect(
			fitScale({ width: 2000, height: 1000 }, { width: 1000, height: 800 }),
		).toBe(0.5);
		expect(
			fitScale({ width: 1000, height: 2000 }, { width: 1000, height: 1200 }),
		).toBe(0.6);
	});

	it("never enlarges a small tree and stops at 40% for a huge one", () => {
		expect(
			fitScale({ width: 400, height: 300 }, { width: 1000, height: 800 }),
		).toBe(ZOOM_MAX);
		expect(
			fitScale({ width: 10_000, height: 300 }, { width: 1000, height: 800 }),
		).toBe(ZOOM_MIN);
	});

	it("keeps 100% while nothing is measured", () => {
		expect(
			fitScale({ width: 0, height: 0 }, { width: 1000, height: 800 }),
		).toBe(1);
		expect(
			fitScale({ width: 2000, height: 900 }, { width: 0, height: 0 }),
		).toBe(1);
	});
});

describe("scrollForZoom", () => {
	it("keeps the content point at the middle of the viewport", () => {
		// At 50%, scroll 100 + half of 400 is screen 300, content 600.
		const scroll = scrollForZoom(100, 400, 0.5, 1);
		// At 100%, content 600 at the middle needs scroll 600 − 200.
		expect(scroll).toBe(400);
		expect(scrollForZoom(scroll, 400, 1, 0.5)).toBe(100);
	});

	it("never scrolls before the start", () => {
		expect(scrollForZoom(0, 400, 1, 0.4)).toBe(0);
	});
});
