import { useEffect } from "react";
import { rectOf } from "./rect";
import {
	type VariableAssistActions,
	isContextKey,
} from "./variable-assist-context";

/** Text of the response body viewer that "Set as variable" may take. */
const RESPONSE_BODY = '[data-id="response"] [data-id="response-body"]';

const SELECTION_THROTTLE_MS = 100;

/** The selection when it lies inside the response body, else `null`. */
function responseSelection(): Selection | null {
	const selection = document.getSelection();
	if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
		return null;
	}
	const node = selection.anchorNode;
	const element =
		node instanceof Element ? node : (node?.parentElement ?? null);
	return element?.closest(RESPONSE_BODY) ? selection : null;
}

/**
 * Offers "Set as variable" for text selected in the response body (a
 * plain `<pre>`, not an editor), and opens it with Shift+F10 or the menu
 * key while that selection stands.
 */
export function useResponseSelection(
	actions: VariableAssistActions,
	active: boolean,
): void {
	useEffect(() => {
		if (!active) return;
		const owner = {};
		let pending: ReturnType<typeof setTimeout> | null = null;
		const check = () => {
			pending = null;
			const selection = responseSelection();
			if (!selection) {
				actions.unselect(owner);
				return;
			}
			actions.select(owner, selection.toString(), () => {
				const current = responseSelection();
				if (!current) return null;
				const rect = current.getRangeAt(0).getBoundingClientRect();
				return rectOf(rect.right, rect.top, 0, rect.height);
			});
		};
		// Dragging over a large body fires this on every move: read the
		// selection (and copy its text) at most once per interval.
		const onChange = () => {
			pending ??= setTimeout(check, SELECTION_THROTTLE_MS);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (!isContextKey(event)) return;
			const selection = responseSelection();
			if (!selection) return;
			event.preventDefault();
			actions.setAsVariable(selection.toString());
		};
		document.addEventListener("selectionchange", onChange);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("selectionchange", onChange);
			document.removeEventListener("keydown", onKeyDown);
			if (pending !== null) clearTimeout(pending);
			actions.unselect(owner);
		};
	}, [actions, active]);
}
