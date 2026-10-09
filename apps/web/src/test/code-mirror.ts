import { EditorView } from "@codemirror/view";
import { act, fireEvent } from "@testing-library/react";

/**
 * CodeMirror ignores synthetic key events in jsdom, so tests drive the
 * editor through its view, as a user's typing would end up.
 */
export function editorView(frame: Element): EditorView {
	const content = frame.querySelector(".cm-content");
	const view =
		content instanceof HTMLElement ? EditorView.findFromDOM(content) : null;
	if (!view) throw new Error("No CodeMirror editor inside this element");
	return view;
}

export function editorText(frame: Element): string {
	return editorView(frame).state.doc.toString();
}

export function setEditorText(frame: Element, text: string): void {
	const view = editorView(frame);
	act(() => {
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: text },
		});
	});
}

/**
 * Leaves the editor, which runs its blur validation. jsdom does not move
 * focus into contenteditable elements, so the events are fired directly.
 */
export function blurEditor(frame: Element): void {
	const { contentDOM } = editorView(frame);
	fireEvent.focus(contentDOM);
	fireEvent.blur(contentDOM);
}
