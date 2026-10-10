import { Badge } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { isDeliveryError } from "../mock-callbacks/delivery";
import { deliveryErrorText } from "../mock-callbacks/delivery-attempts";
import type { LogSummary } from "./request-log-parse";

const NOTE = "m-0 text-muted text-sm wrap-anywhere";

/**
 * Detail lines of an inbox or callback request: which inbox caught it and
 * where it was forwarded, or which callback went where, then each
 * delivery attempt with its answer. Nothing for other sources.
 */
export function LogDeliveryInfo({ row }: { row: LogSummary }) {
	const t = useT();
	let line = null;
	if (row.source === "callback") {
		line = (
			<p data-id="request-log-detail-callback" className={NOTE}>
				{renderRich(
					t("trafficLog.delivery.callback", {
						event: row.event ?? "",
						target: row.target ?? "",
					}),
				)}
			</p>
		);
	} else if (row.source === "inbox" && row.inbox !== null) {
		line = (
			<p data-id="request-log-detail-inbox" className={NOTE}>
				{renderRich(
					row.target
						? t("trafficLog.delivery.inboxForwarded", {
								name: row.inbox,
								target: row.target,
							})
						: t("trafficLog.delivery.inboxKept", { name: row.inbox }),
				)}
			</p>
		);
	}
	const attempts = row.attempts ?? [];
	if (line === null && attempts.length === 0) return null;
	return (
		<div className="grid gap-2">
			{line}
			{attempts.length > 0 ? (
				<ol
					aria-label={t("trafficLog.delivery.attempts")}
					data-id="request-log-detail-attempts"
					className="m-0 grid list-none gap-1 p-0"
				>
					{attempts.map((attempt, index) => (
						<li
							key={`${attempt.at}-${attempt.ms}`}
							data-id={`request-log-detail-attempts-${index + 1}`}
							className="flex flex-wrap items-center gap-2 text-sm"
						>
							<span>
								{t("trafficLog.delivery.attempt", { n: String(index + 1) })}
							</span>
							{attempt.status === null ? null : (
								<Badge tone={attempt.status < 400 ? "success" : "danger"}>
									{attempt.status}
								</Badge>
							)}
							<span className="font-mono text-muted">
								{t("trafficLog.table.ms", { ms: attempt.ms })}
							</span>
							{attempt.error ? (
								<span className="text-muted wrap-anywhere">
									{isDeliveryError(attempt.error)
										? deliveryErrorText(t, attempt.error)
										: attempt.error}
								</span>
							) : null}
						</li>
					))}
				</ol>
			) : null}
		</div>
	);
}
