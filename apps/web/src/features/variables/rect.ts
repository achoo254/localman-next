/** A `DOMRect`-shaped value (`new DOMRect` is missing in some test DOMs). */
export function rectOf(
	left: number,
	top: number,
	width: number,
	height: number,
): DOMRect {
	return {
		x: left,
		y: top,
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
		toJSON: () => ({ left, top, width, height }),
	};
}

/** Whether the point lies inside `rect` (edges included). */
export function containsPoint(rect: DOMRect, x: number, y: number): boolean {
	return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** Where `offset` falls in the overlay's text, under the input. */
export function overlayRect(
	overlay: HTMLElement | null,
	input: HTMLInputElement,
	offset: number,
): DOMRect {
	const box = input.getBoundingClientRect();
	const walker = document.createTreeWalker(
		overlay ?? input,
		NodeFilter.SHOW_TEXT,
	);
	let seen = 0;
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const length = node.textContent?.length ?? 0;
		if (offset <= seen + length) {
			const range = document.createRange();
			range.setStart(node, offset - seen);
			range.collapse(true);
			const left = range.getBoundingClientRect().left || box.left;
			return rectOf(left, box.top, 0, box.height);
		}
		seen += length;
	}
	return rectOf(box.left, box.top, 0, box.height);
}
