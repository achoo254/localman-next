import { type ReactNode, useMemo, useRef, useState } from "react";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { DiffLineRow, DiffMoreButton } from "./diff-line-row";
import { collapseDiff, diffLines, jsonLines } from "./line-diff";

/** Lines drawn at first, and added by each "Show more". */
const RENDER_STEP = 2000;

export interface DiffViewProps {
	before: unknown;
	after: unknown;
	/** Screen-reader name of the diff ("Changes to Users"). */
	label: string;
}

/**
 * Formatted JSON before and after, line by line: `-` removed, `+` added.
 * Unchanged runs fold to three lines around each change, and at most
 * `RENDER_STEP` lines are drawn until the reader asks for more.
 */
export function DiffView({ before, after, label }: DiffViewProps) {
	const t = useT();
	const sectionRef = useRef<HTMLElement>(null);
	const chunks = useMemo(
		() => collapseDiff(diffLines(jsonLines(before), jsonLines(after))),
		[before, after],
	);
	const [unfolded, setUnfolded] = useState<ReadonlySet<number>>(new Set());
	const [limit, setLimit] = useState(RENDER_STEP);
	if (!chunks.some((c) => c.lines.some((line) => line.kind !== "same"))) {
		return (
			<p className="m-0 text-muted text-xs">
				{t("collections.changelog.noChange")}
			</p>
		);
	}
	// The button goes away with a click: keep the focus in the diff.
	const unfold = (index: number) => {
		setUnfolded((current) => new Set([...current, index]));
		sectionRef.current?.focus();
	};
	const rows: ReactNode[] = [];
	let budget = limit;
	let rest = 0;
	for (const [index, chunk] of chunks.entries()) {
		if (chunk.kind === "folded" && !unfolded.has(index)) {
			if (budget > 0) {
				rows.push(
					<DiffMoreButton key={`fold-${index}`} onClick={() => unfold(index)}>
						{t("collections.changelog.unchangedLines", {
							count: chunk.lines.length,
						})}
					</DiffMoreButton>,
				);
			}
			continue;
		}
		for (const [at, line] of chunk.lines.entries()) {
			if (budget <= 0) {
				rest += 1;
				continue;
			}
			budget -= 1;
			rows.push(<DiffLineRow key={`${index}-${at}`} line={line} />);
		}
	}
	return (
		<section
			ref={sectionRef}
			aria-label={label}
			// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1).
			tabIndex={0}
			data-id="changelog-diff"
			className={cn(
				"max-h-80 overflow-auto rounded-sm border border-border-subtle bg-surface font-mono text-[0.6875rem] leading-relaxed",
				"focus-visible:shadow-focus-primary focus-visible:outline-none",
			)}
		>
			{rows}
			{rest > 0 ? (
				<DiffMoreButton
					dataId="changelog-diff-more"
					onClick={() => setLimit((current) => current + RENDER_STEP)}
				>
					{t("collections.changelog.moreLines", { count: rest })}
				</DiffMoreButton>
			) : null}
		</section>
	);
}
