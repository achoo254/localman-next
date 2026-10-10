/**
 * Pure maths of the tree canvas zoom. The canvas scales its content with
 * a CSS transform inside a scroll viewport, so scroll offsets and pointer
 * moves are screen pixels while the layout is in content pixels:
 * content = screen / scale.
 */

/** Smallest and largest scale "Fit" may pick (100% is the largest). */
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 1;

export interface Size {
	readonly width: number;
	readonly height: number;
}

const clamp = (value: number): number =>
	Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

/**
 * Scale at which the whole content fits the viewport, kept within
 * 40–100%: a small tree stays at 100%, a huge one stops at 40% and
 * scrolls. An unmeasured viewport (no layout yet) keeps 100%.
 */
export function fitScale(content: Size, viewport: Size): number {
	if (content.width <= 0 || content.height <= 0) return ZOOM_MAX;
	if (viewport.width <= 0 || viewport.height <= 0) return ZOOM_MAX;
	return clamp(
		Math.min(viewport.width / content.width, viewport.height / content.height),
	);
}

/**
 * Scroll offset (one axis) that keeps the content point at the middle of
 * the viewport in place when the scale changes from `from` to `to`.
 */
export function scrollForZoom(
	scroll: number,
	viewport: number,
	from: number,
	to: number,
): number {
	const middle = (scroll + viewport / 2) / from;
	return Math.max(0, middle * to - viewport / 2);
}
