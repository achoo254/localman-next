import { Compartment, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * Extras of the data modal's JSON editor, applied to the CodeMirror view
 * the shared `JsonEditor` creates (found from its DOM): a keyboard
 * reachable, labelled scroll area, a line wrap that can be switched, and
 * moving to a record.
 */

/** The CodeMirror view rendered inside `container`, if any. */
export function editorViewIn(container: HTMLElement | null): EditorView | null {
	const editor = container?.querySelector<HTMLElement>(".cm-editor");
	return editor ? EditorView.findFromDOM(editor) : null;
}

/**
 * Lets keyboard users scroll the data before they edit it: CodeMirror
 * keeps its scroller out of the tab order (`tabindex="-1"`), which axe
 * reports as `scrollable-region-focusable`.
 */
export function labelScroller(view: EditorView, label: string): void {
	const scroller = view.scrollDOM;
	scroller.tabIndex = 0;
	scroller.setAttribute("role", "region");
	scroller.setAttribute("aria-label", label);
}

const wrapCompartments = new WeakMap<EditorView, Compartment>();

/** Turns line wrapping on or off without recreating the editor (undo kept). */
export function setLineWrapping(view: EditorView, wrap: boolean): void {
	const extension = wrap ? EditorView.lineWrapping : [];
	const existing = wrapCompartments.get(view);
	if (existing) {
		view.dispatch({ effects: existing.reconfigure(extension) });
		return;
	}
	const compartment = new Compartment();
	wrapCompartments.set(view, compartment);
	view.dispatch({
		effects: StateEffect.appendConfig.of(compartment.of(extension)),
	});
}

/** Puts the cursor at `offset`, scrolls it to the top and focuses the editor. */
export function revealOffset(view: EditorView, offset: number): void {
	view.dispatch({
		selection: { anchor: offset },
		effects: EditorView.scrollIntoView(offset, { y: "start", yMargin: 8 }),
	});
	view.focus();
}
