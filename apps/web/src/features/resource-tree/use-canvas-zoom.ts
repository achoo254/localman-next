import {
	type KeyboardEvent,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { type Size, ZOOM_MAX, fitScale, scrollForZoom } from "./canvas-zoom";

export type ZoomMode = "actual" | "fit";

export interface CanvasZoom {
	mode: ZoomMode;
	scale: number;
	/** Scroll viewport of the canvas; measured for "Fit". */
	viewportRef: RefObject<HTMLDivElement | null>;
	fit: () => void;
	actual: () => void;
	/** Shift+1 fits, Shift+0 goes back to 100% (keys of design tools). */
	onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const px = (value: string): number => Number.parseFloat(value) || 0;

/**
 * Room for the content inside the viewport: its width, and its height
 * capped by `max-height` (the viewport shrinks with a scaled tree, so its
 * own height would ratchet the fit down). Padding is left out.
 */
function viewportSize(element: HTMLElement): Size {
	const style = getComputedStyle(element);
	const maxHeight = Number.parseFloat(style.maxHeight);
	const height = Number.isFinite(maxHeight) ? maxHeight : element.clientHeight;
	return {
		width: element.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
		height: height - px(style.paddingTop) - px(style.paddingBottom),
	};
}

/**
 * Zoom of the tree canvas: 100% (default) or "Fit", which scales the
 * whole tree into the viewport (40–100%) and keeps fitting while the
 * viewport or the tree changes size. Going back to 100% keeps the point
 * at the middle of the viewport in place.
 */
export function useCanvasZoom(content: Size): CanvasZoom {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const [mode, setMode] = useState<ZoomMode>("actual");
	const [scale, setScale] = useState(ZOOM_MAX);
	// Scroll to apply once the new scale is rendered.
	const pendingScroll = useRef<{ left: number; top: number } | null>(null);
	const { width, height } = content;

	const measureFit = useCallback((): number => {
		const element = viewportRef.current;
		return element
			? fitScale({ width, height }, viewportSize(element))
			: ZOOM_MAX;
	}, [width, height]);

	useLayoutEffect(() => {
		const element = viewportRef.current;
		const scroll = pendingScroll.current;
		if (!element || !scroll) return;
		pendingScroll.current = null;
		element.scrollLeft = scroll.left;
		element.scrollTop = scroll.top;
	});

	useEffect(() => {
		if (mode !== "fit") return;
		setScale(measureFit());
		const element = viewportRef.current;
		if (!element || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => setScale(measureFit()));
		observer.observe(element);
		return () => observer.disconnect();
	}, [mode, measureFit]);

	const fit = useCallback(() => {
		pendingScroll.current = { left: 0, top: 0 };
		setScale(measureFit());
		setMode("fit");
	}, [measureFit]);

	const actual = useCallback(() => {
		const element = viewportRef.current;
		if (element) {
			pendingScroll.current = {
				left: scrollForZoom(
					element.scrollLeft,
					element.clientWidth,
					scale,
					ZOOM_MAX,
				),
				top: scrollForZoom(
					element.scrollTop,
					element.clientHeight,
					scale,
					ZOOM_MAX,
				),
			};
		}
		setScale(ZOOM_MAX);
		setMode("actual");
	}, [scale]);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>) => {
			if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
				return;
			if (event.code === "Digit1") fit();
			else if (event.code === "Digit0") actual();
			else return;
			event.preventDefault();
		},
		[fit, actual],
	);

	return { mode, scale, viewportRef, fit, actual, onKeyDown };
}
