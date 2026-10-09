import { ensureSyntaxTree } from "@codemirror/language";
import { type Diagnostic, setDiagnostics } from "@codemirror/lint";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { invalidJsonMessage, parseJsonText } from "../../lib/json-text";

export interface JsonValidationOptions {
	/** Empty text counts as valid. */
	allowEmpty?: boolean;
	/** Extra check of parsed JSON; returns an error message or null. */
	validate?: (value: unknown) => string | null;
}

/** Offset of the first syntax error in CodeMirror's JSON tree, if any. */
function errorPosition(state: EditorState): number | null {
	const tree = ensureSyntaxTree(state, state.doc.length, 200);
	let at: number | null = null;
	tree?.iterate({
		enter: (node) => {
			if (at !== null) return false;
			if (node.type.isError) at = node.from;
			return undefined;
		},
	});
	return at;
}

/** Runs the blur validation and marks the error in the text. */
export function checkJsonEditor(
	view: EditorView,
	props: JsonValidationOptions,
): string | null {
	const text = view.state.doc.toString();
	const diagnostics: Diagnostic[] = [];
	let error: string | null = null;
	if (text.trim() === "") {
		error = props.allowEmpty ? null : invalidJsonMessage();
	} else {
		const parsed = parseJsonText(text);
		if (!parsed.ok) {
			const from = errorPosition(view.state) ?? text.length;
			const line = view.state.doc.lineAt(Math.min(from, text.length));
			error = invalidJsonMessage({
				line: line.number,
				column: from - line.from + 1,
			});
			const to = Math.min(from + 1, text.length);
			diagnostics.push({
				from: Math.min(from, to),
				to,
				severity: "error",
				message: error,
			});
		} else {
			error = props.validate?.(parsed.value) ?? null;
		}
	}
	view.dispatch(setDiagnostics(view.state, diagnostics));
	return error;
}
