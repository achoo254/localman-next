import { Badge } from "../../components/ui/badge";
import { formatDate } from "../../lib/format";
import { EmailMatchBadge } from "./email-match-badge";
import type { ProInterestSubmissionEntry } from "./pro-interest-item";
import {
	needsLabel,
	priceLabel,
	sourceLabel,
	teamLabel,
} from "./pro-interest-labels";

/** Every submission for one address, newest first. */
export function SubmissionHistory({
	entries,
	dataId,
}: {
	entries: ProInterestSubmissionEntry[];
	dataId: string;
}) {
	if (entries.length === 0) {
		return <p className="m-0 text-muted text-sm">Chưa có lịch sử gửi.</p>;
	}
	return (
		<ol data-id={dataId} className="m-0 grid list-none gap-3 p-0">
			{entries.map((entry, index) => (
				<li
					key={`${entry.at}-${index}`}
					data-id={`${dataId}-${index + 1}`}
					className="grid gap-1 border-border-subtle border-l-2 pl-3 text-sm"
				>
					<span className="flex flex-wrap items-center gap-2">
						<span className="font-mono text-[0.8125rem]">
							{formatDate(entry.at)}
						</span>
						<span className="text-muted">{sourceLabel(entry.source)}</span>
						<EmailMatchBadge matches={entry.emailMatchesAccount} />
						{entry.applied ? null : <Badge>Không áp dụng</Badge>}
					</span>
					<span>
						{entry.name || "—"} · {needsLabel(entry.needs)} · Quy mô{" "}
						{teamLabel(entry.teamSize)}
						{entry.priceHint ? ` · ${priceLabel(entry.priceHint)}` : ""}
					</span>
					{entry.note ? (
						<span className="text-muted">“{entry.note}”</span>
					) : null}
				</li>
			))}
		</ol>
	);
}
