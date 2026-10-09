import { Badge } from "../../components/ui/badge";
import { useI18n } from "../../i18n/i18n-context";
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
	const { t, formatDate } = useI18n();
	if (entries.length === 0) {
		return (
			<p className="m-0 text-muted text-sm">{t("admin.pro.historyEmpty")}</p>
		);
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
						<span className="text-muted">{sourceLabel(t, entry.source)}</span>
						<EmailMatchBadge matches={entry.emailMatchesAccount} />
						{entry.applied ? null : <Badge>{t("admin.pro.notApplied")}</Badge>}
					</span>
					<span>
						{entry.name || "—"} · {needsLabel(t, entry.needs)} ·{" "}
						{t("admin.pro.historyTeam", { size: teamLabel(t, entry.teamSize) })}
						{entry.priceHint ? ` · ${priceLabel(t, entry.priceHint)}` : ""}
					</span>
					{entry.note ? (
						<span className="text-muted">“{entry.note}”</span>
					) : null}
				</li>
			))}
		</ol>
	);
}
