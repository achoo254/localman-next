/**
 * Where `{{name}}` references sit in a text, and the `{{` being typed:
 * pure functions shared by the CodeMirror highlighter and the single-line
 * variable inputs.
 */
import { VARIABLE_PATTERN } from "@localman/shared/api-client";

export interface VariableSpan {
	/** Offset of the first `{`. */
	from: number;
	/** Offset just after the last `}`. */
	to: number;
	/** The trimmed name between the braces. */
	name: string;
}

/** Every `{{name}}` of `text` in order; blank names are left out. */
export function findVariableSpans(text: string): VariableSpan[] {
	const spans: VariableSpan[] = [];
	for (const match of text.matchAll(VARIABLE_PATTERN)) {
		const name = match[1]?.trim() ?? "";
		if (!name) continue;
		const from = match.index ?? 0;
		spans.push({ from, to: from + match[0].length, name });
	}
	return spans;
}

/** The span the caret at `offset` sits strictly inside, if any. */
export function spanAt(
	spans: readonly VariableSpan[],
	offset: number,
): VariableSpan | null {
	return spans.find((span) => span.from < offset && offset < span.to) ?? null;
}

export interface SuggestionTarget {
	/** Offset where the typed name starts (just after `{{`). */
	from: number;
	/** What was typed after `{{` so far. */
	query: string;
}

const OPEN_REFERENCE = /\{\{([^{}\s]*)$/;

/** The name being typed after an unclosed `{{` before the caret. */
export function suggestionAt(
	text: string,
	caret: number,
): SuggestionTarget | null {
	const match = OPEN_REFERENCE.exec(text.slice(0, caret));
	if (!match) return null;
	const query = match[1] ?? "";
	return { from: caret - query.length, query };
}

const REST_OF_REFERENCE = /^([^{}\s]*)\}\}/;

export interface SuggestionEdit {
	from: number;
	to: number;
	insert: string;
	/** Caret after the edit: just past the closing `}}`. */
	caret: number;
}

/**
 * The edit that completes `{{query` with `name`: it replaces the rest of
 * a reference already closed after the caret, else closes it with `}}`.
 */
export function suggestionEdit(
	text: string,
	target: SuggestionTarget,
	caret: number,
	name: string,
): SuggestionEdit {
	const rest = REST_OF_REFERENCE.exec(text.slice(caret));
	const to = rest ? caret + (rest[1]?.length ?? 0) : caret;
	const insert = rest ? name : `${name}}}`;
	return {
		from: target.from,
		to,
		insert,
		caret: target.from + name.length + 2,
	};
}

/** `text` with `edit` applied. */
export function applyEdit(text: string, edit: SuggestionEdit): string {
	return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}
