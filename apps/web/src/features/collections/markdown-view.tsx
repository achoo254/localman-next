/**
 * A small Markdown subset for collection and folder descriptions, built
 * as React elements (never HTML strings, so markup in the text stays
 * text): headings `#`–`###`, paragraphs, `-`/`*` and `1.` lists, fenced
 * code blocks, `inline code`, **bold**, *italic* and [links](https://…)
 * (opened through `ExternalLink`, which drops unsafe URLs).
 */
import type { ReactNode } from "react";
import { ExternalLink } from "../../components/ui/external-link";

export type MarkdownBlock =
	| { kind: "heading"; level: 1 | 2 | 3; text: string }
	| { kind: "paragraph"; text: string }
	| { kind: "list"; ordered: boolean; items: string[] }
	| { kind: "code"; text: string };

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

/** The blocks of `source`, in order. */
export function parseMarkdown(source: string): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];
	const lines = source.replace(/\r\n?/g, "\n").split("\n");
	let paragraph: string[] = [];
	const endParagraph = () => {
		if (paragraph.length > 0) {
			blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
		}
		paragraph = [];
	};
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i] ?? "";
		if (line.trimStart().startsWith("```")) {
			endParagraph();
			const code: string[] = [];
			for (
				i += 1;
				i < lines.length && !lines[i]?.trimStart().startsWith("```");
				i += 1
			) {
				code.push(lines[i] ?? "");
			}
			blocks.push({ kind: "code", text: code.join("\n") });
			continue;
		}
		const heading = HEADING.exec(line);
		const item = BULLET.exec(line) ?? NUMBERED.exec(line);
		if (heading?.[1] && heading[2] !== undefined) {
			endParagraph();
			const level =
				heading[1].length === 1 ? 1 : heading[1].length === 2 ? 2 : 3;
			blocks.push({ kind: "heading", level, text: heading[2] });
		} else if (item?.[1] !== undefined) {
			endParagraph();
			const ordered = NUMBERED.test(line);
			const last = blocks.at(-1);
			if (last?.kind === "list" && last.ordered === ordered)
				last.items.push(item[1]);
			else blocks.push({ kind: "list", ordered, items: [item[1]] });
		} else if (line.trim() === "") {
			endParagraph();
		} else {
			paragraph.push(line.trim());
		}
	}
	endParagraph();
	return blocks;
}

const INLINE =
	/(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*]+\*|_[^_]+_)/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

/** Inline marks of one block's text. */
export function renderInline(text: string): ReactNode[] {
	const out: ReactNode[] = [];
	let last = 0;
	for (const match of text.matchAll(INLINE)) {
		const [token] = match;
		const at = match.index ?? 0;
		if (at > last) out.push(text.slice(last, at));
		const key = `${at}`;
		const link = LINK.exec(token);
		if (token.startsWith("`")) {
			out.push(
				<code
					key={key}
					className="rounded-xs bg-fg/6 px-1 font-mono text-[0.8125rem]"
				>
					{token.slice(1, -1)}
				</code>,
			);
		} else if (token.startsWith("**")) {
			out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
		} else if (link?.[1] && link[2]) {
			out.push(
				<ExternalLink
					key={key}
					href={link[2]}
					className="text-primary underline"
				>
					{link[1]}
				</ExternalLink>,
			);
		} else {
			out.push(<em key={key}>{token.slice(1, -1)}</em>);
		}
		last = at + token.length;
	}
	if (last < text.length) out.push(text.slice(last));
	return out;
}

const HEADING_CLASS = {
	1: "m-0 font-bold font-mono text-lg",
	2: "m-0 font-bold font-mono text-base",
	3: "m-0 font-semibold font-mono text-sm",
} as const;

export function MarkdownView({ source }: { source: string }) {
	return (
		<div className="grid gap-3 text-sm leading-relaxed">
			{parseMarkdown(source).map((block, index) => {
				const key = `${block.kind}-${index}`;
				switch (block.kind) {
					case "heading": {
						const Tag =
							block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
						return (
							<Tag key={key} className={HEADING_CLASS[block.level]}>
								{renderInline(block.text)}
							</Tag>
						);
					}
					case "paragraph":
						return (
							<p key={key} className="m-0">
								{renderInline(block.text)}
							</p>
						);
					case "code":
						return (
							<pre
								key={key}
								className="m-0 overflow-x-auto rounded-md bg-surface-subtle p-3 font-mono text-xs"
							>
								<code>{block.text}</code>
							</pre>
						);
					case "list": {
						const List = block.ordered ? "ol" : "ul";
						return (
							<List
								key={key}
								className={
									block.ordered ? "m-0 list-decimal pl-6" : "m-0 list-disc pl-6"
								}
							>
								{block.items.map((item, i) => (
									<li key={`${i}-${item}`}>{renderInline(item)}</li>
								))}
							</List>
						);
					}
				}
			})}
		</div>
	);
}
