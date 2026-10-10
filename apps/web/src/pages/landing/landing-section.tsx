import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface LandingSectionProps {
	/** Anchor for in-page links (`#pricing`); the h2 id derives from it. */
	id: string;
	"data-id": string;
	/** Short label above the title; written in sentence case, shown uppercase. */
	eyebrow: string;
	title: ReactNode;
	/** 1 when the block is the page itself (`/pricing`); 2 on the landing. */
	headingLevel?: 1 | 2;
	lead?: ReactNode;
	className?: string;
	/** Extra classes for the eyebrow/title/lead block (grid placement). */
	headerClassName?: string;
	children: ReactNode;
}

/**
 * One landing block: eyebrow, heading (h2 unless set) and lead, left-aligned, with the section
 * labelled by its title. Vertical rhythm is 64px, 96px from 768px up.
 */
export function LandingSection({
	id,
	"data-id": dataId,
	eyebrow,
	title,
	headingLevel = 2,
	lead,
	className,
	headerClassName,
	children,
}: LandingSectionProps) {
	const titleId = `${id}-title`;
	const Heading = headingLevel === 1 ? "h1" : "h2";
	return (
		<section
			id={id}
			data-id={dataId}
			aria-labelledby={titleId}
			className={cn("grid gap-8 py-16 md:py-24", className)}
		>
			<div className={cn("grid content-start gap-3", headerClassName)}>
				<p className="m-0 font-mono font-semibold text-primary text-xs uppercase tracking-[0.12em]">
					{eyebrow}
				</p>
				<Heading
					id={titleId}
					className="m-0 font-bold text-[clamp(1.625rem,4vw,2.25rem)] leading-tight tracking-[-0.02em]"
				>
					{title}
				</Heading>
				{lead ? (
					<p className="m-0 max-w-160 text-[1.0625rem] text-muted">{lead}</p>
				) : null}
			</div>
			{children}
		</section>
	);
}
