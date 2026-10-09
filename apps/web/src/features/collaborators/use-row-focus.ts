import { type RefObject, useRef } from "react";

export interface RowFocusRefs {
	list: RefObject<HTMLUListElement | null>;
	input: RefObject<HTMLInputElement | null>;
	close: RefObject<HTMLButtonElement | null>;
}

function usable(element: HTMLElement | null): element is HTMLElement {
	return element?.isConnected === true && !element.matches(":disabled");
}

/**
 * Keeps focus off rows that disappear. `remember(id)` picks the target
 * while the list is still intact (the next row's X button, else the invite
 * input, else Đóng); `restore()` moves focus there once the row or the
 * confirmation that removed it is gone. Never `body`.
 */
export function useRowFocus({ list, input, close }: RowFocusRefs) {
	const target = useRef<HTMLElement | null>(null);

	function rowOf(id: string): Element | null {
		return (
			list.current?.querySelector(`[data-collaborator-id="${id}"]`) ?? null
		);
	}

	function remember(id: string) {
		let next = rowOf(id)?.nextElementSibling ?? null;
		while (next && next.getAttribute("data-state") === "leaving") {
			next = next.nextElementSibling;
		}
		target.current =
			next?.querySelector<HTMLElement>("[data-remove-button]") ?? null;
	}

	/** True when it moved focus. */
	function restore(): boolean {
		const fallback = usable(input.current) ? input.current : close.current;
		const element = usable(target.current) ? target.current : fallback;
		target.current = null;
		element?.focus();
		return element !== null;
	}

	/** Right before a row is dropped: only if focus is still on it (or lost). */
	function beforeGone(id: string) {
		const active = document.activeElement;
		if (!active || active === document.body || rowOf(id)?.contains(active)) {
			restore();
		}
	}

	return { remember, restore, beforeGone };
}
