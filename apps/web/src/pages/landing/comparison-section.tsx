import { limitsFor } from "@localman/shared/constants";
import { IconExternalLink } from "@tabler/icons-react";
import { cardClassName } from "../../components/ui/card";
import { ExternalLink } from "../../components/ui/external-link";
import { useFeatures } from "../../config/features";
import {
	COMPETITOR_FACTS,
	type CompetitorCell,
} from "../../content/competitor-facts";
import { cn } from "../../lib/cn";
import { formatDate } from "../../lib/format";
import { LandingSection } from "./landing-section";

const CELL = "border-border-subtle border-t px-4 py-3 align-top";
const LOCALMAN_CELL = "bg-primary/6 font-semibold text-fg";

/** Footnote number of a source: its position in the list under the table. */
function sourceNumber(id: CompetitorCell["sourceId"]): number {
	return COMPETITOR_FACTS.sources.findIndex((source) => source.id === id) + 1;
}

/** A competitor's value with the footnote of the page it was read from. */
function CompetitorTd({ cell }: { cell: CompetitorCell }) {
	const n = sourceNumber(cell.sourceId);
	const label = COMPETITOR_FACTS.sources[n - 1]?.label ?? "";
	return (
		<td className={cn(CELL, "text-muted")}>
			{cell.text}
			<sup className="ml-1">
				<a href={`#compare-source-${n}`} aria-label={`Nguồn ${n}: ${label}`}>
					{n}
				</a>
			</sup>
		</td>
	);
}

/**
 * Free plans side by side. Rows of features not in production are hidden,
 * not marked "Sắp có": a promise next to a competitor's shipped feature
 * reads as a feature we already have.
 */
export function ComparisonSection() {
	const flags = useFeatures();
	const free = limitsFor("free");
	const rows = COMPETITOR_FACTS.rows.filter(
		(row) => row.requires === undefined || flags[row.requires],
	);
	return (
		<LandingSection
			id="compare"
			data-id="landing-compare"
			eyebrow="So sánh"
			title="Localman so với mockapi.io và Postman"
			lead="Số liệu gói Free công khai của từng bên, ghi ngày và nguồn để bạn tự kiểm."
		>
			<div className={cn(cardClassName, "grid gap-0 overflow-hidden")}>
				<section
					aria-label="Bảng so sánh, cuộn ngang"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1).
					tabIndex={0}
					className="overflow-x-auto"
				>
					<table className="w-full min-w-160 border-collapse text-left text-sm">
						<caption className="sr-only">
							So sánh gói Free của Localman, mockapi.io và Postman
						</caption>
						<thead>
							<tr className="font-mono text-xs">
								<th scope="col" className="sticky left-0 bg-surface px-4 py-3">
									Tiêu chí
								</th>
								<th
									scope="col"
									className={cn(
										"border-primary border-t-3 px-4 py-3",
										LOCALMAN_CELL,
									)}
								>
									Localman
								</th>
								<th scope="col" className="px-4 py-3">
									mockapi.io
								</th>
								<th scope="col" className="px-4 py-3">
									Postman
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.key} data-id={`landing-compare-row-${row.key}`}>
									<th
										scope="row"
										className={cn(CELL, "sticky left-0 bg-surface font-medium")}
									>
										{row.label}
									</th>
									<td className={cn(CELL, LOCALMAN_CELL)}>
										{row.localman(free)}
									</td>
									<CompetitorTd cell={row.mockapi} />
									<CompetitorTd cell={row.postman} />
								</tr>
							))}
						</tbody>
					</table>
				</section>
				<p
					data-id="landing-compare-meta"
					className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 border-border-subtle border-t px-4 py-3 text-[0.8125rem] text-muted"
				>
					<span>Cập nhật {formatDate(COMPETITOR_FACTS.updatedAt)}</span>
					<span aria-hidden="true">·</span>
					<span>Nguồn:</span>
					{COMPETITOR_FACTS.sources.map((source, index) => (
						<span key={source.id} id={`compare-source-${index + 1}`}>
							[{index + 1}]{" "}
							<ExternalLink
								href={source.url}
								data-id={`landing-compare-source-${index + 1}`}
								className="inline-flex items-center gap-1"
							>
								{source.label}
								<IconExternalLink size={14} aria-hidden="true" />
								<span className="sr-only"> (mở ở tab mới)</span>
							</ExternalLink>
						</span>
					))}
					<span className="basis-full">{COMPETITOR_FACTS.note}</span>
				</p>
			</div>
		</LandingSection>
	);
}
