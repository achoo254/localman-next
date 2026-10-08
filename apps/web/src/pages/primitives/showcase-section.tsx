import type { ReactNode } from "react";

export interface ShowcaseSectionProps {
	dataId: string;
	title: string;
	description?: string;
	children: ReactNode;
}

/** Card-style block grouping one family of primitives on the showcase page. */
export function ShowcaseSection({
	dataId,
	title,
	description,
	children,
}: ShowcaseSectionProps) {
	const headingId = `${dataId}-title`;
	return (
		<section
			data-id={dataId}
			aria-labelledby={headingId}
			className="grid gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
		>
			<div className="grid gap-1">
				<h2 id={headingId} className="m-0 font-mono font-semibold text-base">
					{title}
				</h2>
				{description ? (
					<p className="m-0 text-muted text-sm">{description}</p>
				) : null}
			</div>
			{children}
		</section>
	);
}
