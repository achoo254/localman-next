import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * CodeMirror look built only from design tokens, so the editor follows the
 * light/dark theme with the rest of the app. The frame (border, focus ring,
 * invalid state) is drawn by the wrapper in `json-editor.tsx`.
 */
export const jsonEditorTheme = EditorView.theme({
	"&": {
		color: "var(--c-text)",
		backgroundColor: "transparent",
		fontSize: "0.8125rem",
		height: "100%",
	},
	"&.cm-focused": { outline: "none" },
	".cm-scroller": {
		fontFamily: "var(--font-mono)",
		lineHeight: "1.55",
	},
	".cm-content": {
		padding: "var(--space-2) 0",
		caretColor: "var(--c-text)",
	},
	".cm-line": { padding: "0 var(--space-3)" },
	".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--c-text)" },
	"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
		{
			backgroundColor: "color-mix(in srgb, var(--c-primary) 22%, transparent)",
		},
	".cm-placeholder": { color: "var(--c-text-muted)" },
	".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
		backgroundColor: "color-mix(in srgb, var(--c-primary) 14%, transparent)",
		outline: "1px solid color-mix(in srgb, var(--c-primary) 45%, transparent)",
	},
	".cm-lintRange-error": {
		backgroundImage: "none",
		textDecoration: "underline wavy var(--c-error)",
		textUnderlineOffset: "3px",
	},
	".cm-tooltip": {
		border: "1px solid var(--c-border)",
		backgroundColor: "var(--c-surface)",
		color: "var(--c-text)",
		borderRadius: "var(--radius-sm)",
	},
	".cm-diagnostic-error": { borderLeftColor: "var(--c-error)" },
});

/** JSON tokens: keys in primary, strings in accent, literals in info. */
export const jsonHighlighting = syntaxHighlighting(
	HighlightStyle.define([
		{ tag: tags.propertyName, color: "var(--c-primary)" },
		{ tag: tags.string, color: "var(--c-accent)" },
		{ tag: [tags.number, tags.bool, tags.null], color: "var(--c-info)" },
		{
			tag: [tags.punctuation, tags.separator, tags.brace, tags.squareBracket],
			color: "var(--c-text-muted)",
		},
		{ tag: tags.invalid, color: "var(--c-error)" },
	]),
);
