import {
	defaultKeymap,
	history,
	historyKeymap,
	indentMore,
} from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
	EditorView,
	keymap,
	lineNumbers,
	placeholder as placeholderExtension,
} from "@codemirror/view";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import {
	type CodeLanguage,
	codeHighlighting,
	loadLanguage,
} from "./code-editor-languages";
import { jsonEditorTheme } from "./json-editor-theme";

export interface CodeEditorProps {
	value: string;
	onChange: (value: string) => void;
	/** Grammar for highlighting; loaded on demand. */
	language: CodeLanguage;
	/** Accessible name; use `labelledBy` instead when a visible label exists. */
	label?: string;
	labelledBy?: string;
	describedBy?: string;
	readOnly?: boolean;
	placeholder?: string;
	/** Line numbers in a gutter (scripts, long bodies). */
	lineNumbers?: boolean;
	/** Sizing classes of the frame, e.g. `min-h-40` or `h-96`. */
	className?: string;
	/** More CodeMirror extensions (the `{{variable}}` highlighter); swapped when they change. */
	extensions?: Extension;
	"data-id"?: string;
}

type AccessProps = Pick<
	CodeEditorProps,
	"label" | "labelledBy" | "describedBy"
>;

function accessibility(props: AccessProps): Extension {
	return EditorView.contentAttributes.of({
		...(props.label ? { "aria-label": props.label } : {}),
		...(props.labelledBy ? { "aria-labelledby": props.labelledBy } : {}),
		...(props.describedBy ? { "aria-describedby": props.describedBy } : {}),
		"aria-multiline": "true",
		spellcheck: "false",
	});
}

function readOnlyState(readOnly: boolean): Extension {
	return EditorState.readOnly.of(readOnly);
}

/**
 * Code text field on CodeMirror 6 for any of `CODE_LANGUAGES`: same frame,
 * theme and keys as `JsonEditor` (Tab leaves the field, Ctrl/Cmd+] indents)
 * without JSON validation. The grammar loads after the editor shows, so
 * text is editable at once and gains colours a moment later.
 */
export function CodeEditor(props: CodeEditorProps) {
	const host = useRef<HTMLDivElement>(null);
	const view = useRef<EditorView | null>(null);
	const latest = useRef(props);
	latest.current = props;
	const grammar = useRef(new Compartment());
	const access = useRef(new Compartment());
	const editable = useRef(new Compartment());
	const extra = useRef(new Compartment());

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
					props.lineNumbers ? lineNumbers() : [],
					grammar.current.of([]),
					codeHighlighting,
					jsonEditorTheme,
					keymap.of([
						...defaultKeymap,
						...historyKeymap,
						{ key: "Mod-]", run: indentMore },
					]),
					placeholderExtension(props.placeholder ?? ""),
					access.current.of(accessibility(props)),
					editable.current.of(readOnlyState(Boolean(props.readOnly))),
					extra.current.of(props.extensions ?? []),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							latest.current.onChange(update.state.doc.toString());
						}
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
		let current = true;
		loadLanguage(props.language)
			.then((support) => {
				if (!current) return;
				view.current?.dispatch({
					effects: grammar.current.reconfigure(support ?? []),
				});
			})
			// Without its grammar the editor still works, only uncoloured.
			.catch(() => undefined);
		return () => {
			current = false;
		};
	}, [props.language]);

	useEffect(() => {
		const instance = view.current;
		if (!instance || instance.state.doc.toString() === props.value) return;
		instance.dispatch({
			changes: { from: 0, to: instance.state.doc.length, insert: props.value },
		});
	}, [props.value]);

	useEffect(() => {
		view.current?.dispatch({
			effects: extra.current.reconfigure(props.extensions ?? []),
		});
	}, [props.extensions]);

	const { label, labelledBy, describedBy, readOnly } = props;
	useEffect(() => {
		view.current?.dispatch({
			effects: [
				access.current.reconfigure(
					accessibility({ label, labelledBy, describedBy }),
				),
				editable.current.reconfigure(readOnlyState(Boolean(readOnly))),
			],
		});
	}, [label, labelledBy, describedBy, readOnly]);

	return (
		<div
			ref={host}
			data-id={props["data-id"]}
			data-language={props.language}
			className={cn(
				// minmax(0,1fr) keeps long lines scrolling inside the frame.
				"grid min-h-24 min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden rounded-md border border-border-strong bg-surface",
				"transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-focus-primary",
				"[&_.cm-gutters]:border-border-subtle [&_.cm-gutters]:border-r [&_.cm-gutters]:bg-surface-subtle [&_.cm-gutters]:text-muted",
				props.className,
			)}
		/>
	);
}
