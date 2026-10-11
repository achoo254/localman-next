import { type RefObject, useEffect, useRef } from "react";

/** Below Tailwind's `md` the right panel is a drawer over the page. */
const DRAWER_QUERY = "(max-width: 47.99rem)";

const isDrawer = (): boolean =>
	typeof window.matchMedia === "function" &&
	window.matchMedia(DRAWER_QUERY).matches;

/**
 * Focus for the right panel when it is a drawer (below `md`): on open the
 * focus moves to `focusRef` (the close button), Escape anywhere closes,
 * and on close the focus returns to what opened it. Side by side (wider)
 * the panel leaves the focus where it is, and only returns it when it
 * was inside the panel that closed.
 */
export function useDrawerFocus(
	open: boolean,
	close: () => void,
	panelRef: RefObject<HTMLElement | null>,
	focusRef: RefObject<HTMLElement | null>,
): void {
	const opener = useRef<HTMLElement | null>(null);
	const closeRef = useRef(close);
	closeRef.current = close;
	useEffect(() => {
		if (!open) return;
		const active = document.activeElement;
		opener.current = active instanceof HTMLElement ? active : null;
		if (isDrawer()) focusRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented || !isDrawer())
				return;
			event.preventDefault();
			closeRef.current();
		};
		document.addEventListener("keydown", onKeyDown);
		const panel = panelRef.current;
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			const focus = document.activeElement;
			const lost =
				focus === null ||
				focus === document.body ||
				panel?.contains(focus) === true;
			const back = opener.current;
			if ((lost || isDrawer()) && back?.isConnected) back.focus();
		};
	}, [open, panelRef, focusRef]);
}
