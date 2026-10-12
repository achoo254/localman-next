/**
 * The assist part of the CodeMirror highlighter: the hover card over a
 * marked `{{name}}`, suggestions while `{{name` is typed (↑/↓, Enter or
 * Tab, Escape), the "Set as variable" offer for a selection, and
 * Shift+F10 / the menu key for both from the keyboard.
 */
import {
	type Extension,
	Prec,
	StateEffect,
	StateField,
} from "@codemirror/state";
import {
	EditorView,
	ViewPlugin,
	type ViewUpdate,
	keymap,
} from "@codemirror/view";
import { rectOf } from "./rect";
import { listAttributes } from "./suggest-aria";
import type {
	SuggestAria,
	VariableAssistActions,
} from "./variable-assist-context";
import {
	findVariableSpans,
	spanAt,
	suggestionAt,
	suggestionEdit,
} from "./variable-spans";

const SUGGEST_KEYS = ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"];

function caretRect(view: EditorView, pos: number): DOMRect | null {
	const coords = view.coordsAtPos(pos);
	if (!coords) return null;
	return rectOf(coords.left, coords.top, 0, coords.bottom - coords.top);
}

/** The `{{name` being typed at the caret, against the caret's line. */
function typedReference(view: EditorView) {
	const { head } = view.state.selection.main;
	const line = view.state.doc.lineAt(head);
	const caret = head - line.from;
	const target = suggestionAt(line.text, caret);
	return target ? { line, caret, target } : null;
}

function completeWith(view: EditorView, name: string): void {
	const typed = typedReference(view);
	if (!typed) return;
	const { line, caret, target } = typed;
	const edit = suggestionEdit(line.text, target, caret, name);
	view.dispatch({
		changes: {
			from: line.from + edit.from,
			to: line.from + edit.to,
			insert: edit.insert,
		},
		selection: { anchor: line.from + edit.caret },
		userEvent: "input.complete",
	});
}

const setAria = StateEffect.define<SuggestAria | null>();

/** The open list's id and active option, for the content's ARIA. */
const suggestAria = StateField.define<SuggestAria | null>({
	create: () => null,
	update: (value, tr) =>
		tr.effects.reduce(
			(next, effect) => (effect.is(setAria) ? effect.value : next),
			value,
		),
	provide: (field) =>
		EditorView.contentAttributes.from(field, (aria) => ({
			...(aria ? { "aria-autocomplete": "list" } : {}),
			...listAttributes(aria),
		})),
});

/** Shift+F10 / menu key: "Set as variable" for a selection, else the card. */
export function contextAction(
	view: EditorView,
	actions: VariableAssistActions,
): boolean {
	const range = view.state.selection.main;
	if (!range.empty) {
		actions.setAsVariable(view.state.sliceDoc(range.from, range.to));
		return true;
	}
	const line = view.state.doc.lineAt(range.head);
	const span = spanAt(findVariableSpans(line.text), range.head - line.from);
	if (!span) return false;
	const start = caretRect(view, line.from + span.from);
	const end = caretRect(view, line.from + span.to);
	// Without geometry (not laid out yet) the card sits by the editor.
	const rect =
		start && end
			? rectOf(start.left, start.top, end.left - start.left, start.height)
			: view.contentDOM.getBoundingClientRect();
	actions.focusCard(span.name, rect, view.contentDOM);
	return true;
}

export function variableEditorAssist(
	actions: VariableAssistActions,
): Extension {
	const plugin = ViewPlugin.fromClass(
		class {
			/** Suggestions were offered: a caret move updates or closes them. */
			open = false;
			/** Cleared on destroy: a late ARIA update must not dispatch. */
			alive = true;
			constructor(readonly view: EditorView) {}
			update(update: ViewUpdate) {
				const { view, state } = update;
				const range = state.selection.main;
				if (update.focusChanged && !view.hasFocus) {
					this.open = false;
					actions.closeSuggest(view);
					actions.unselect(view);
					return;
				}
				if (update.selectionSet || update.focusChanged) {
					if (range.empty) actions.unselect(view);
					else {
						const text = state.sliceDoc(range.from, range.to);
						actions.select(view, text, () => caretRect(view, range.to));
					}
				}
				const typed = update.transactions.some(
					(tr) => tr.isUserEvent("input") || tr.isUserEvent("delete"),
				);
				if (!typed && !(update.selectionSet && this.open)) return;
				const reference = range.empty ? typedReference(view) : null;
				this.open = reference !== null;
				if (!reference) {
					actions.closeSuggest(view);
					return;
				}
				actions.suggest({
					owner: view,
					query: reference.target.query,
					anchor: () => caretRect(view, view.state.selection.main.head),
					pick: (name) => completeWith(view, name),
					onAria: (aria) => {
						if (this.alive) view.dispatch({ effects: setAria.of(aria) });
					},
				});
			}
			destroy() {
				this.alive = false;
				actions.closeSuggest(this.view);
				actions.unselect(this.view);
			}
		},
	);
	const pointer = EditorView.domEventHandlers({
		mousemove(event) {
			const target = event.target;
			const mark =
				target instanceof Element ? target.closest("[data-var]") : null;
			const name = mark?.getAttribute("data-var");
			if (mark && name) actions.hover(name, mark.getBoundingClientRect());
			else actions.unhover();
		},
		mouseleave() {
			actions.unhover();
		},
	});
	const keys = Prec.highest(
		keymap.of([
			...SUGGEST_KEYS.map((key) => ({
				key,
				run: () => actions.suggestKey(key),
			})),
			{ key: "Shift-F10", run: (view) => contextAction(view, actions) },
			{ key: "ContextMenu", run: (view) => contextAction(view, actions) },
		]),
	);
	return [suggestAria, plugin, pointer, keys];
}
