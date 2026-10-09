import { Fragment, type ReactNode } from "react";

/**
 * Renders copy where text between backticks is code, e.g.
 * "Biến `LOCALMAN_MCP_TOKEN`": keeps sentences whole in the copy file
 * instead of splitting them around `<code>` elements.
 */
export function CodeSpans({ text }: { text: string }): ReactNode {
	return text.split("`").map((part, index) =>
		index % 2 === 1 ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: parts of a fixed string never reorder.
			<code key={index}>{part}</code>
		) : (
			// biome-ignore lint/suspicious/noArrayIndexKey: parts of a fixed string never reorder.
			<Fragment key={index}>{part}</Fragment>
		),
	);
}
