import {
	defaultKeymap,
	history,
	historyKeymap,
	indentMore,
} from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import {
	EditorView,
	keymap,
	placeholder as placeholderExtension,
} from "@codemirror/view";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import { jsonEditorTheme, jsonHighlighting } from "./json-editor-theme";
import { checkJsonEditor } from "./json-editor-validation";

export interface JsonEditorProps {
	value: string;
	onChange: (value: string) => void;
	/** Accessible name; use `labelledBy` instead when a visible label exists. */
	label?: string;
	labelledBy?: string;
	describedBy?: string;
	/** Marks the editor invalid (red frame, aria-invalid). */
	invalid?: boolean;
	disabled?: boolean;
	readOnly?: boolean;
	placeholder?: string;
	/** Empty text counts as valid (an optional template). */
	allowEmpty?: boolean;
	/** Extra check of parsed JSON; returns an error message or null. */
	validate?: (value: unknown) => string | null;
	/** Called on blur with the problem found, or null when the JSON is valid. */
	onValidate?: (error: string | null) => void;
	/**
	 * Wraps long lines (templates, responses). Off by default: data keeps
	 * one line per value and scrolls sideways inside the frame.
	 */
	lineWrapping?: boolean;
	/** Sizing classes of the frame, e.g. `min-h-24` or `h-96`. */
	className?: string;
	"data-id"?: string;
}

type AccessProps = Pick<
	JsonEditorProps,
	"label" | "labelledBy" | "describedBy" | "invalid"
>;

function accessibility(props: AccessProps) {
	return EditorView.contentAttributes.of({
		...(props.label ? { "aria-label": props.label } : {}),
		...(props.labelledBy ? { "aria-labelledby": props.labelledBy } : {}),
		...(props.describedBy ? { "aria-describedby": props.describedBy } : {}),
		...(props.invalid ? { "aria-invalid": "true" } : {}),
		"aria-multiline": "true",
		spellcheck: "false",
	});
}

/**
 * JSON text field on CodeMirror 6: highlighting, bracket matching, undo
 * history and validation on blur (error underlined, message reported
 * through `onValidate`). Tab is left to focus navigation so keyboard users
 * can leave the field; Ctrl/Cmd+] indents instead.
 */
export function JsonEditor(props: JsonEditorProps) {
	const host = useRef<HTMLDivElement>(null);
	const view = useRef<EditorView | null>(null);
	const latest = useRef(props);
	latest.current = props;
	const access = useRef(new Compartment());
	const editable = useRef(new Compartment());

	// biome-ignore lint/correctness/useExhaustiveDependencies: the editor is created once; later prop changes are applied by the effects below.
	useEffect(() => {
		if (!host.current) return;
		const instance = new EditorView({
			parent: host.current,
			state: EditorState.create({
				doc: props.value,
				extensions: [
					history(),
					indentOnInput(),
					bracketMatching(),
					json(),
					jsonHighlighting,
					jsonEditorTheme,
					keymap.of([
						...defaultKeymap,
						...historyKeymap,
						{ key: "Mod-]", run: indentMore },
					]),
					placeholderExtension(props.placeholder ?? ""),
					props.lineWrapping ? EditorView.lineWrapping : [],
					access.current.of(accessibility(props)),
					editable.current.of(editableState(props)),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							latest.current.onChange(update.state.doc.toString());
						}
					}),
					EditorView.domEventHandlers({
						blur: (_event, editor) => {
							latest.current.onValidate?.(
								checkJsonEditor(editor, latest.current),
							);
							return false;
						},
					}),
				],
			}),
		});
		view.current = instance;
		return () => {
			instance.destroy();
			view.current = null;
		};
	}, []);

	useEffect(() => {
		const instance = view.current;
		if (!instance || instance.state.doc.toString() === props.value) return;
		instance.dispatch({
			changes: { from: 0, to: instance.state.doc.length, insert: props.value },
		});
	}, [props.value]);

	const { label, labelledBy, describedBy, invalid, disabled, readOnly } = props;
	useEffect(() => {
		view.current?.dispatch({
			effects: [
				access.current.reconfigure(
					accessibility({ label, labelledBy, describedBy, invalid }),
				),
				editable.current.reconfigure(editableState({ disabled, readOnly })),
			],
		});
	}, [label, labelledBy, describedBy, invalid, disabled, readOnly]);

	return (
		<div
			ref={host}
			data-id={props["data-id"]}
			data-invalid={props.invalid ? "true" : undefined}
			data-disabled={props.disabled ? "true" : undefined}
			className={cn(
				// The minmax(0,1fr) track keeps .cm-editor as wide as the frame, so
				// long lines scroll inside .cm-scroller instead of widening the modal.
				"grid min-h-24 min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden rounded-md border border-border-strong bg-surface",
				"transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-focus-primary",
				"data-[invalid=true]:border-error data-[invalid=true]:focus-within:shadow-focus-error",
				"data-[disabled=true]:bg-surface-subtle data-[disabled=true]:opacity-55",
				props.className,
			)}
		/>
	);
}

function editableState(props: Pick<JsonEditorProps, "disabled" | "readOnly">) {
	const locked = Boolean(props.disabled || props.readOnly);
	return [
		EditorView.editable.of(!props.disabled),
		EditorState.readOnly.of(locked),
	];
}
