import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { cn } from "../../lib/cn";
import {
	DOCS_PAGES,
	type DocsPage,
	docsNeighbours,
	docsPath,
} from "./docs-pages";

/** Table of contents; the current page gets `aria-current="page"`. */
function DocsToc() {
	return (
		<nav aria-label="Mục lục tài liệu" data-id="docs-toc">
			<p className="m-0 mb-2 font-mono font-semibold text-muted text-xs uppercase tracking-wide">
				Tài liệu
			</p>
			<ol className="m-0 flex list-none flex-wrap gap-2 p-0 md:flex-col md:gap-1">
				{DOCS_PAGES.map((page) => (
					<li key={page.slug}>
						<NavLink
							to={docsPath(page.slug)}
							data-id={`docs-toc-${page.slug}`}
							className={({ isActive }) =>
								cn(
									"grid rounded-md border px-3 py-2 no-underline transition-colors",
									isActive
										? "border-primary bg-surface text-primary"
										: "border-transparent text-fg hover:bg-surface-subtle",
								)
							}
						>
							<span className="font-semibold text-sm">{page.title}</span>
							<span className="hidden text-muted text-xs md:block">
								{page.summary}
							</span>
						</NavLink>
					</li>
				))}
			</ol>
		</nav>
	);
}

function PagerLink({
	page,
	direction,
}: {
	page: DocsPage;
	direction: "previous" | "next";
}) {
	const next = direction === "next";
	return (
		<Link
			to={docsPath(page.slug)}
			rel={next ? "next" : "prev"}
			data-id={`docs-pager-${direction}`}
			className={cn(
				"grid gap-1 rounded-md border border-border bg-surface px-4 py-3 no-underline transition-colors hover:border-primary",
				next && "text-right sm:col-start-2",
			)}
		>
			<span
				className={cn(
					"flex items-center gap-1 text-muted text-xs",
					next && "justify-end",
				)}
			>
				{next ? null : <IconArrowLeft size={14} aria-hidden="true" />}
				{next ? "Trang sau" : "Trang trước"}
				{next ? <IconArrowRight size={14} aria-hidden="true" /> : null}
			</span>
			<span className="font-semibold text-primary">{page.title}</span>
		</Link>
	);
}

/** Previous/next links in reading order, below every page. */
function DocsPager({ slug }: { slug: string }) {
	const { previous, next } = docsNeighbours(slug);
	if (!previous && !next) return null;
	return (
		<nav
			aria-label="Trang trước và trang sau"
			data-id="docs-pager"
			className="grid gap-3 border-border-subtle border-t pt-6 sm:grid-cols-2"
		>
			{previous ? <PagerLink page={previous} direction="previous" /> : null}
			{next ? <PagerLink page={next} direction="next" /> : null}
		</nav>
	);
}

/**
 * Public docs (`/docs/*`, no sign-in): table of contents beside the page
 * from 768px, above it on phones; previous/next links at the bottom.
 */
export function DocsLayout() {
	const { pathname } = useLocation();
	const slug = pathname.replace(/\/+$/, "").split("/").at(-1) ?? "";
	return (
		<div
			data-id="docs"
			className="grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12"
		>
			<aside className="md:sticky md:top-[calc(var(--topbar-h)+var(--space-6))] md:self-start">
				<DocsToc />
			</aside>
			<div className="grid min-w-0 max-w-192 gap-12">
				<Outlet />
				<DocsPager slug={slug} />
			</div>
		</div>
	);
}
