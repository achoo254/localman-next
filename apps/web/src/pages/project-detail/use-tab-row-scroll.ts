import { type RefObject, useEffect, useRef, useState } from "react";

/** Below this many pixels of hidden tabs the row counts as fully shown. */
const EDGE_TOLERANCE = 1;

/** Scroll box of the tab row, as the DOM reports it. */
export interface TabRowBox {
	clientWidth: number;
	scrollWidth: number;
	scrollLeft: number;
}

/** Whether tabs are hidden past the right edge of the row. */
export function hasHiddenTabsRight(row: TabRowBox): boolean {
	return row.scrollLeft + row.clientWidth < row.scrollWidth - EDGE_TOLERANCE;
}

/**
 * `scrollLeft` that centres a tab in the row, clamped to the scroll range.
 * Offsets are relative to the row, which must be the tab's offset parent.
 */
export function centredScrollLeft(
	row: Pick<TabRowBox, "clientWidth" | "scrollWidth">,
	tab: { offsetLeft: number; offsetWidth: number },
): number {
	const centred = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
	const max = Math.max(0, row.scrollWidth - row.clientWidth);
	return Math.min(max, Math.max(0, centred));
}

/**
 * Horizontal tab row on narrow screens: `fade` tells whether tabs hide
 * past the right edge (the row shows a fade there), and the tab matching
 * `selectedTab` (a selector within the row) scrolls to the row's centre
 * whenever it changes.
 */
export function useTabRowScroll(selectedTab: string): {
	rowRef: RefObject<HTMLDivElement | null>;
	fade: boolean;
} {
	const rowRef = useRef<HTMLDivElement | null>(null);
	const [fade, setFade] = useState(false);

	useEffect(() => {
		const row = rowRef.current;
		if (!row) return;
		const update = () => setFade(hasHiddenTabsRight(row));
		update();
		row.addEventListener("scroll", update, { passive: true });
		const observer =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
		observer?.observe(row);
		return () => {
			row.removeEventListener("scroll", update);
			observer?.disconnect();
		};
	}, []);

	useEffect(() => {
		const row = rowRef.current;
		const tab = row?.querySelector<HTMLElement>(selectedTab);
		if (!row || !tab) return;
		// Not smooth on purpose: the row only moves when the choice changes.
		row.scrollLeft = centredScrollLeft(row, tab);
		setFade(hasHiddenTabsRight(row));
	}, [selectedTab]);

	return { rowRef, fade };
}
