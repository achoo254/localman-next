import { describe, expect, it } from "vitest";
import { centredScrollLeft, hasHiddenTabsRight } from "./use-tab-row-scroll";

describe("tab row scrolling", () => {
	it("sees tabs hidden at the right until the row is scrolled to its end", () => {
		const row = { clientWidth: 200, scrollWidth: 500 };
		expect(hasHiddenTabsRight({ ...row, scrollLeft: 0 })).toBe(true);
		expect(hasHiddenTabsRight({ ...row, scrollLeft: 299.5 })).toBe(false);
		expect(hasHiddenTabsRight({ ...row, scrollLeft: 300 })).toBe(false);
		expect(
			hasHiddenTabsRight({ clientWidth: 500, scrollWidth: 500, scrollLeft: 0 }),
		).toBe(false);
	});

	it("centres a tab, clamped to the start and the end of the row", () => {
		const row = { clientWidth: 200, scrollWidth: 500 };
		expect(centredScrollLeft(row, { offsetLeft: 200, offsetWidth: 100 })).toBe(
			150,
		);
		expect(centredScrollLeft(row, { offsetLeft: 0, offsetWidth: 100 })).toBe(0);
		expect(centredScrollLeft(row, { offsetLeft: 400, offsetWidth: 100 })).toBe(
			300,
		);
		expect(
			centredScrollLeft(
				{ clientWidth: 500, scrollWidth: 500 },
				{ offsetLeft: 300, offsetWidth: 100 },
			),
		).toBe(0);
	});
});
