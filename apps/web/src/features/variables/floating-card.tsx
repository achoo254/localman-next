import {
	type ComponentProps,
	type Ref,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import type { AnchorRect } from "./variable-assist-context";

export interface FloatingCardProps
	extends Omit<ComponentProps<"div">, "style" | "ref"> {
	anchor: AnchorRect;
	ref?: Ref<HTMLDivElement>;
}

/** Distance from the anchor and from the window's edges, in CSS pixels. */
const GAP = 4;
const EDGE = 8;

interface Position {
	top: number;
	left: number;
}

/** Below the anchor, or above when it does not fit; kept inside the window. */
export function placeBelow(
	anchor: DOMRect,
	size: { width: number; height: number },
	viewport: { width: number; height: number },
): Position {
	const below = anchor.bottom + GAP;
	const fitsBelow = below + size.height <= viewport.height - EDGE;
	const above = anchor.top - GAP - size.height;
	const top = fitsBelow || above < EDGE ? below : above;
	const maxLeft = Math.max(EDGE, viewport.width - EDGE - size.width);
	return { top, left: Math.min(Math.max(anchor.left, EDGE), maxLeft) };
}

/**
 * A card fixed next to an anchor rectangle (a variable, the caret, a
 * selection), portalled to the body so no scroll box clips it. It follows
 * its anchor on scroll and resize, and hides while the anchor is gone.
 */
export function FloatingCard({
	anchor,
	ref,
	className,
	children,
	...rest
}: FloatingCardProps) {
	const card = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState<Position | null>(null);
	const latest = useRef(anchor);
	latest.current = anchor;

	const place = useCallback(() => {
		const rect = latest.current();
		const element = card.current;
		if (!rect || !element) {
			setPosition(null);
			return;
		}
		const size = element.getBoundingClientRect();
		const next = placeBelow(rect, size, {
			width: window.innerWidth,
			height: window.innerHeight,
		});
		// Same place: no new state, so measuring after a render ends there.
		setPosition((current) =>
			current && current.top === next.top && current.left === next.left
				? current
				: next,
		);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: a new anchor or content must be measured again.
	useLayoutEffect(() => {
		place();
	}, [place, anchor, children]);

	useLayoutEffect(() => {
		window.addEventListener("scroll", place, true);
		window.addEventListener("resize", place);
		return () => {
			window.removeEventListener("scroll", place, true);
			window.removeEventListener("resize", place);
		};
	}, [place]);

	const setRef = (element: HTMLDivElement | null) => {
		card.current = element;
		if (typeof ref === "function") ref(element);
		else if (ref) ref.current = element;
	};

	return createPortal(
		<div
			ref={setRef}
			{...rest}
			style={
				position
					? { top: position.top, left: position.left }
					: { visibility: "hidden", top: 0, left: 0 }
			}
			className={cn(
				"fixed z-90 rounded-md border border-border bg-surface text-fg shadow-lg",
				className,
			)}
		>
			{children}
		</div>,
		document.body,
	);
}
