import { type PointerEvent, type RefObject, useRef, useState } from "react";

export interface DragPan {
	panning: boolean;
	onPointerDown: (event: PointerEvent<HTMLElement>) => void;
	onPointerMove: (event: PointerEvent<HTMLElement>) => void;
	onPointerUp: (event: PointerEvent<HTMLElement>) => void;
	onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

/**
 * Pressed on a node card (its link, buttons, slider) or on the root rail:
 * those keep their own click, so the press never pans.
 */
const NOT_PANNABLE = '[data-tree-node], button, a, input, [role="slider"]';

/**
 * Drag the empty canvas background to scroll its viewport. Touch keeps
 * the browser's own scrolling. The viewport is outside the zoom
 * transform, so a pointer move of n screen pixels scrolls n pixels at any
 * scale.
 */
export function useDragPan(
	viewportRef: RefObject<HTMLElement | null>,
	enabled: boolean,
): DragPan {
	const start = useRef<{
		pointerId: number;
		x: number;
		y: number;
		left: number;
		top: number;
	} | null>(null);
	const [panning, setPanning] = useState(false);

	function onPointerDown(event: PointerEvent<HTMLElement>) {
		const viewport = viewportRef.current;
		if (!enabled || !viewport || event.button !== 0) return;
		if (event.pointerType === "touch") return;
		if (event.target instanceof Element && event.target.closest(NOT_PANNABLE)) {
			return;
		}
		// No text selection or focus change while dragging the background.
		event.preventDefault();
		start.current = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			left: viewport.scrollLeft,
			top: viewport.scrollTop,
		};
		viewport.setPointerCapture?.(event.pointerId);
		setPanning(true);
	}

	function onPointerMove(event: PointerEvent<HTMLElement>) {
		const viewport = viewportRef.current;
		const from = start.current;
		if (!viewport || !from) return;
		viewport.scrollLeft = from.left - (event.clientX - from.x);
		viewport.scrollTop = from.top - (event.clientY - from.y);
	}

	function end() {
		const from = start.current;
		if (!from) return;
		start.current = null;
		const viewport = viewportRef.current;
		if (viewport?.hasPointerCapture?.(from.pointerId)) {
			viewport.releasePointerCapture(from.pointerId);
		}
		setPanning(false);
	}

	return {
		panning,
		onPointerDown,
		onPointerMove,
		onPointerUp: end,
		onPointerCancel: end,
	};
}
