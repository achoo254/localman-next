import { type ReactNode, useEffect, useId } from "react";
import { Link, useLocation } from "react-router";
import { useT } from "../../i18n/i18n-context";
import {
	type TagRenderer,
	type TagRenderers,
	renderRich,
} from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import { useDocumentTitle } from "../../lib/use-document-title";

/**
 * The router keeps the scroll position across pages: a page opens at the
 * section its link names (`#query`), else at its top.
 */
function useScrollOnArrival(): void {
	const { hash } = useLocation();
	useEffect(() => {
		const target = hash ? document.getElementById(hash.slice(1)) : null;
		if (target) target.scrollIntoView();
		else window.scrollTo({ top: 0 });
	}, [hash]);
}

export interface DocsArticleProps {
	title: string;
	lead: ReactNode;
	"data-id": string;
	children: ReactNode;
}

/** A docs page: the one `h1`, a lead paragraph, then `DocsSection`s. */
export function DocsArticle({
	title,
	lead,
	"data-id": dataId,
	children,
}: DocsArticleProps) {
	const t = useT();
	useDocumentTitle(t("docs.documentTitle", { page: title }));
	useScrollOnArrival();
	return (
		<article data-id={dataId} className="grid min-w-0 gap-10">
			<header className="grid gap-3">
				<h1 className="m-0 font-bold text-3xl tracking-[-0.02em]">{title}</h1>
				<p className="m-0 text-lg text-muted">{lead}</p>
			</header>
			{children}
		</article>
	);
}

export interface DocsSectionProps {
	/** Anchor id, so a section can be linked to. */
	id: string;
	title: string;
	children: ReactNode;
}

export function DocsSection({ id, title, children }: DocsSectionProps) {
	return (
		<section aria-labelledby={id} className="grid min-w-0 gap-4">
			<h2 id={id} className="m-0 font-bold text-xl">
				{title}
			</h2>
			{children}
		</section>
	);
}

/** Body paragraph of a docs page. */
export function Prose({ children }: { children: ReactNode }) {
	return <p className="m-0 text-fg leading-relaxed">{children}</p>;
}

export function InlineCode({ children }: { children: ReactNode }) {
	return (
		<code className="rounded-xs bg-surface-subtle px-1 font-mono text-[0.875em]">
			{children}
		</code>
	);
}

/**
 * Tags of docs texts: `<code>` in the docs' inline code style, `<em>` for
 * stress and `<angle>name</angle>` for a placeholder shown as `<name>`
 * (a literal `<` would break the tag syntax).
 */
const DOCS_TAGS: TagRenderers = {
	code: (chunk) => <InlineCode>{chunk}</InlineCode>,
	em: (chunk) => <em>{chunk}</em>,
	angle: (chunk) => <InlineCode>{`<${chunk}>`}</InlineCode>,
};

/** A translated docs text with its tags rendered; `tags` adds links. */
export function docsRich(text: string, tags: TagRenderers = {}): ReactNode {
	return renderRich(text, { ...DOCS_TAGS, ...tags });
}

/** Renders a tag's text as an in-app link to `to`. */
export function linkTo(to: string): TagRenderer {
	return (chunk) => <Link to={to}>{chunk}</Link>;
}

export interface DocsTableProps {
	caption: string;
	headers: readonly string[];
	rows: readonly (readonly ReactNode[])[];
	"data-id": string;
}

/**
 * Reference table. On narrow screens it scrolls inside its own labelled,
 * focusable region instead of widening the page.
 */
export function DocsTable({
	caption,
	headers,
	rows,
	"data-id": dataId,
}: DocsTableProps) {
	const captionId = useId();
	return (
		<section
			aria-labelledby={captionId}
			data-id={dataId}
			// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1).
			tabIndex={0}
			className="min-w-0 overflow-x-auto rounded-md border border-border"
		>
			<table className="w-full border-collapse text-left text-sm">
				<caption
					id={captionId}
					className="border-border-subtle border-b bg-surface-subtle px-3 py-2 text-left font-semibold"
				>
					{caption}
				</caption>
				<thead>
					<tr>
						{headers.map((header) => (
							<th
								key={header}
								scope="col"
								className="border-border border-b px-3 py-2 font-semibold"
							>
								{header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((cells, row) => (
						<tr
							// biome-ignore lint/suspicious/noArrayIndexKey: static rows that never reorder.
							key={row}
							className={cn(row > 0 && "border-border-subtle border-t")}
						>
							{cells.map((cell, column) => (
								<td
									// biome-ignore lint/suspicious/noArrayIndexKey: static cells.
									key={column}
									className="px-3 py-2 align-top"
								>
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
