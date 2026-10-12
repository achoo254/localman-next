/**
 * CodeMirror extension for editors that accept `{{name}}` (the raw body):
 * colours resolved variables, dynamic `$name`s, and undeclared names in
 * red, then wires the hover card, `{{` suggestions and "Set as variable"
 * (`variable-editor-assist.ts`). Colours come from token variables only.
 */
import {
	type Extension,
	RangeSetBuilder,
	StateEffect,
	StateField,
} from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import type { VariableAssistActions } from "./variable-assist-context";
import { variableEditorAssist } from "./variable-editor-assist";
import type { VariableKind } from "./variable-kinds";
import { findVariableSpans } from "./variable-spans";

export interface VariableMark {
	from: number;
	to: number;
	name: string;
	kind: VariableKind;
}

/** The marks of `text`, a slice of the document starting at `offset`. */
export function variableMarks(
	text: string,
	offset: number,
	classify: (name: string) => VariableKind,
): VariableMark[] {
	return findVariableSpans(text).map((span) => ({
		from: offset + span.from,
		to: offset + span.to,
		name: span.name,
		kind: classify(span.name),
	}));
}

function decorations(
	view: EditorView,
	classify: (name: string) => VariableKind,
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		for (const mark of variableMarks(text, from, classify)) {
			builder.add(
				mark.from,
				mark.to,
				Decoration.mark({
					class: `cm-var cm-var-${mark.kind}`,
					attributes: { "data-var": mark.name, "data-kind": mark.kind },
				}),
			);
		}
	}
	return builder.finish();
}

const variableTheme = EditorView.theme({
	".cm-var": { borderRadius: "var(--radius-xs)" },
	".cm-var-resolved": {
		color: "var(--c-primary)",
		backgroundColor: "color-mix(in srgb, var(--c-primary) 12%, transparent)",
	},
	".cm-var-withheld": {
		color: "var(--c-warning-text)",
		backgroundColor: "color-mix(in srgb, var(--c-warning) 12%, transparent)",
		textDecoration: "underline dotted var(--c-warning)",
		textUnderlineOffset: "3px",
	},
	".cm-var-dynamic": {
		color: "var(--c-accent)",
		backgroundColor: "color-mix(in srgb, var(--c-accent) 12%, transparent)",
	},
	".cm-var-undeclared": {
		color: "var(--c-error-text)",
		backgroundColor: "color-mix(in srgb, var(--c-error) 10%, transparent)",
		textDecoration: "underline wavy var(--c-error)",
		textUnderlineOffset: "3px",
	},
});

/** How names are classified; changes as the scopes load or change. */
export type Classify = (name: string) => VariableKind;

/**
 * The current classifier and its changes, so editors take a new one by a
 * state effect instead of being reconfigured (which would close an open
 * suggestion list on every refetch).
 */
export interface ClassifierSource {
	get: () => Classify;
	set: (classify: Classify) => void;
	subscribe: (listener: (classify: Classify) => void) => () => void;
}

export function classifierSource(initial: Classify): ClassifierSource {
	let current = initial;
	const listeners = new Set<(classify: Classify) => void>();
	return {
		get: () => current,
		set: (classify) => {
			if (classify === current) return;
			current = classify;
			for (const listener of listeners) listener(classify);
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

const setClassifier = StateEffect.define<Classify>();

/** Colouring alone; `variableHighlighter` adds the assist on top. */
export function variableColors(source: ClassifierSource): Extension {
	const classifier = StateField.define<Classify>({
		create: () => source.get(),
		update: (value, tr) =>
			tr.effects.reduce(
				(next, effect) => (effect.is(setClassifier) ? effect.value : next),
				value,
			),
	});
	const plugin = ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			readonly unsubscribe: () => void;
			constructor(view: EditorView) {
				this.decorations = decorations(view, view.state.field(classifier));
				this.unsubscribe = source.subscribe((classify) =>
					view.dispatch({ effects: setClassifier.of(classify) }),
				);
			}
			update(update: ViewUpdate) {
				const classify = update.state.field(classifier);
				if (
					update.docChanged ||
					update.viewportChanged ||
					classify !== update.startState.field(classifier)
				) {
					this.decorations = decorations(update.view, classify);
				}
			}
			destroy() {
				this.unsubscribe();
			}
		},
		{ decorations: (value) => value.decorations },
	);
	return [classifier, plugin, variableTheme];
}

/** Colours plus the hover card, suggestions and "Set as variable". */
export function variableHighlighter(
	source: ClassifierSource,
	actions: VariableAssistActions,
): Extension {
	return [variableColors(source), variableEditorAssist(actions)];
}
