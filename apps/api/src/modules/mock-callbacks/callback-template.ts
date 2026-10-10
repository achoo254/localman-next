import type { JsonValue } from "@localman/shared";

/** Bytes a rendered callback body may have; a longer one is not sent. */
export const MAX_CALLBACK_BODY_BYTES = 64 * 1024;

/** What a template's variables are filled from. */
export interface TemplateContext {
	readonly event: string;
	readonly resource: string;
	readonly record: JsonValue;
}

/** `{{record}}`, `{{record.a.b}}`, `{{event}}`, `{{resource}}`. */
const VARIABLE = /\{\{\s*(record(?:\.[A-Za-z0-9_$-]+)*|event|resource)\s*\}\}/g;

/** The record's own field at `path`; `undefined` when any step is missing. */
function fieldAt(record: JsonValue, path: readonly string[]): unknown {
	let value: unknown = record;
	for (const key of path) {
		if (
			typeof value !== "object" ||
			value === null ||
			Array.isArray(value) ||
			!Object.hasOwn(value, key)
		) {
			return undefined;
		}
		value = (value as Record<string, unknown>)[key];
	}
	return value;
}

/** JSON text of `value` without the quotes of a string. */
function inlined(value: unknown): string {
	if (value === undefined) return "";
	const json = JSON.stringify(value) ?? "";
	return typeof value === "string" ? json.slice(1, -1) : json;
}

/**
 * Fills a callback body template by plain text substitution, never
 * evaluating anything: `{{record}}` is the record as JSON, `{{record.x}}`
 * one of its fields (strings JSON-escaped without quotes, so they fit
 * inside `"…"`; other values as JSON; a missing field as nothing), and
 * `{{event}}`, `{{resource}}` the escaped names. Unknown `{{…}}` stay.
 */
export function renderTemplate(
	template: string,
	context: TemplateContext,
): string {
	return template.replace(VARIABLE, (_match, name: string) => {
		if (name === "event") return inlined(context.event);
		if (name === "resource") return inlined(context.resource);
		if (name === "record") return JSON.stringify(context.record);
		return inlined(fieldAt(context.record, name.split(".").slice(1)));
	});
}
