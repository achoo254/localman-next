import type { LanguageSupport } from "@codemirror/language";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const CODE_LANGUAGES = [
	"json",
	"javascript",
	"xml",
	"html",
	"text",
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

/**
 * Grammar of each language, imported when an editor first needs it, so a
 * page with only JSON never downloads the HTML or JavaScript parsers.
 * Plain text has no grammar.
 */
export async function loadLanguage(
	language: CodeLanguage,
): Promise<LanguageSupport | null> {
	switch (language) {
		case "json":
			return (await import("@codemirror/lang-json")).json();
		case "javascript":
			return (await import("@codemirror/lang-javascript")).javascript();
		case "xml":
			return (await import("@codemirror/lang-xml")).xml();
		case "html":
			return (await import("@codemirror/lang-html")).html();
		case "text":
			return null;
	}
}

/**
 * Token colours of every language, from design tokens only: names and
 * tags in primary, strings in accent, literals in info, comments muted.
 */
export const codeHighlighting = syntaxHighlighting(
	HighlightStyle.define([
		{
			tag: [
				tags.propertyName,
				tags.tagName,
				tags.definition(tags.variableName),
			],
			color: "var(--c-primary)",
		},
		{ tag: [tags.string, tags.attributeValue], color: "var(--c-accent)" },
		{
			tag: [tags.number, tags.bool, tags.null, tags.atom],
			color: "var(--c-info)",
		},
		{
			tag: [tags.keyword, tags.attributeName, tags.operatorKeyword],
			color: "var(--c-warning-text)",
		},
		{
			tag: [tags.comment, tags.meta, tags.processingInstruction],
			color: "var(--c-text-muted)",
			fontStyle: "italic",
		},
		{
			tag: [
				tags.punctuation,
				tags.separator,
				tags.brace,
				tags.squareBracket,
				tags.angleBracket,
			],
			color: "var(--c-text-muted)",
		},
		{ tag: tags.invalid, color: "var(--c-error)" },
	]),
);
