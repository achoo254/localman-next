import type { Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

export interface AnchorRange {
	from: number;
	to: number;
	threadId: string;
	/** Hover text: who commented. */
	title: string;
}

const theme = EditorView.baseTheme({
	".cm-comment-anchor": {
		backgroundColor: "color-mix(in srgb, var(--c-warning) 22%, transparent)",
		borderBottom: "2px solid var(--c-warning)",
		cursor: "pointer",
	},
});

/**
 * Marks the text inline comments point at; a click on a mark opens its
 * thread. Ranges past the end of the text are dropped.
 */
export function anchorHighlight(
	ranges: readonly AnchorRange[],
	onOpen: (threadId: string) => void,
): Extension {
	return [
		theme,
		EditorView.decorations.compute(["doc"], (state) => {
			const length = state.doc.length;
			const marks = ranges
				.filter((range) => range.to <= length && range.from < range.to)
				.map((range) =>
					Decoration.mark({
						class: "cm-comment-anchor",
						attributes: {
							"data-comment-thread": range.threadId,
							title: range.title,
						},
					}).range(range.from, range.to),
				);
			return Decoration.set(marks, true);
		}),
		EditorView.domEventHandlers({
			click(event) {
				if (!(event.target instanceof Element)) return false;
				const mark = event.target.closest("[data-comment-thread]");
				const threadId = mark?.getAttribute("data-comment-thread");
				if (!threadId) return false;
				onOpen(threadId);
				return false;
			},
		}),
	];
}
