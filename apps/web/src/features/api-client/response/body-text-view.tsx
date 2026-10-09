import { useEffect, useMemo, useRef } from "react";
import { useT } from "../../../i18n/i18n-context";
import { cn } from "../../../lib/cn";
import { type TextMatch, splitByMatches } from "./body-search";
import { type JsonTokenKind, highlightJson } from "./json-highlight";
import { MAX_HIGHLIGHT_CHARS } from "./response-content";

export interface BodyTextViewProps {
	text: string;
	/** Colour JSON tokens (Pretty view of a JSON body, no active search). */
	highlight: boolean;
	matches: readonly TextMatch[];
	/** Index of the match to scroll to and mark as current. */
	current: number;
}

const TOKEN_CLASSES: Record<JsonTokenKind, string> = {
	key: "text-primary",
	string: "text-accent",
	number: "text-info-text",
	literal: "text-info-text",
	plain: "",
};

/**
 * The body as text in the mono font. Search hits are `<mark>`; JSON gets
 * colours only when there is no search and the body is not huge.
 */
export function BodyTextView({
	text,
	highlight,
	matches,
	current,
}: BodyTextViewProps) {
	const t = useT();
	const pre = useRef<HTMLPreElement>(null);

	useEffect(() => {
		const mark = pre.current?.querySelector(`[data-match="${current}"]`);
		mark?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
	}, [current]);

	const content = useMemo(() => {
		if (matches.length > 0) {
			return splitByMatches(text, matches).map((segment, index) =>
				segment.match === null ? (
					segment.text
				) : (
					<mark
						// biome-ignore lint/suspicious/noArrayIndexKey: segments never reorder.
						key={index}
						data-match={segment.match}
						data-current={segment.match === current || undefined}
						className="rounded-sm bg-warning/30 text-fg data-current:bg-warning/70"
					>
						{segment.text}
					</mark>
				),
			);
		}
		if (highlight && text.length <= MAX_HIGHLIGHT_CHARS) {
			return highlightJson(text).map((token, index) =>
				token.kind === "plain" ? (
					token.text
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: tokens never reorder.
					<span key={index} className={TOKEN_CLASSES[token.kind]}>
						{token.text}
					</span>
				),
			);
		}
		return text;
	}, [text, highlight, matches, current]);

	return (
		<pre
			ref={pre}
			data-id="response-body"
			aria-label={t("apiClientTools.response.tabs.body")}
			// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1).
			tabIndex={0}
			className={cn(
				"m-0 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all p-4",
				"font-mono text-[0.8125rem] text-fg leading-relaxed",
			)}
		>
			{content}
		</pre>
	);
}
