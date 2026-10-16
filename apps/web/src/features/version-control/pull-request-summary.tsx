import type { PullRequestDetail } from "@localman/shared/api-client";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { useI18n } from "../../i18n/i18n-context";
import { MarkdownView } from "../collections/markdown-view";
import { PullRequestStatusBadge } from "./pull-request-status";

/** Status, fork and source, author, description, reviews and outcome. */
export function PullRequestSummary({
	pullRequest: pr,
}: {
	pullRequest: PullRequestDetail;
}) {
	const { t, formatDate } = useI18n();
	return (
		<>
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<PullRequestStatusBadge status={pr.status} />
				<span className="text-muted">
					{pr.forkLabel
						? t("versionControl.pullRequests.fromFork", { label: pr.forkLabel })
						: t("versionControl.pullRequests.forkGone")}
					{" → "}
					{t("versionControl.pullRequests.into", {
						name: pr.sourceName ?? "?",
					})}
				</span>
				<span className="text-muted text-xs">
					{t("versionControl.pullRequests.by", {
						person: pr.authorName ?? "?",
						date: formatDate(pr.createdAt),
					})}
				</span>
			</div>
			{pr.description ? <MarkdownView source={pr.description} /> : null}
			{pr.reviewers.length > 0 ? (
				<ul
					data-id="pull-request-reviewers"
					aria-label={t("versionControl.pullRequests.reviewers")}
					className="m-0 flex list-none flex-wrap gap-2 p-0"
				>
					{pr.reviewers.map((reviewer) => (
						<li
							key={reviewer.userId}
							className="flex items-center gap-1 text-sm"
						>
							<span>{reviewer.name ?? "?"}</span>
							<Badge
								tone={
									reviewer.decision === "approved"
										? "success"
										: reviewer.decision === "declined"
											? "danger"
											: "neutral"
								}
							>
								{t(`versionControl.pullRequests.decision.${reviewer.decision}`)}
							</Badge>
						</li>
					))}
				</ul>
			) : null}
			{pr.status === "merged" && pr.mergedAt ? (
				<Alert tone="success">
					{t("versionControl.pullRequests.mergedBy", {
						person: pr.mergedByName ?? "?",
						date: formatDate(pr.mergedAt),
					})}
				</Alert>
			) : pr.status === "declined" ? (
				<Alert tone="warning">{t("versionControl.pullRequests.closed")}</Alert>
			) : pr.preview && pr.preview.changes.length === 0 ? (
				<p className="m-0 text-muted text-sm">
					{t("versionControl.pullRequests.noChanges")}
				</p>
			) : null}
		</>
	);
}
