import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/ui/card";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { LogDeliveryInfo } from "./log-delivery";
import { DETAIL_TITLE, LogBody, LogHeaders } from "./log-message-views";
import { fetchLogLine } from "./request-log-api";
import {
	type LogSummary,
	type ReplayResult,
	localmanSource,
} from "./request-log-parse";
import { fullPath, methodClass } from "./request-log-row";
import { SourceBadge } from "./source-badge";

export interface RequestLogDetailProps {
	projectId: string;
	/** DOM id the path buttons point at (`aria-controls`). */
	id: string;
	row: LogSummary | null;
	/** Answer of the last replay of this row, if any. */
	replay: ReplayResult | undefined;
}

function useMeta(): (
	status: number,
	ms: number,
	source: string | null,
) => string {
	const t = useT();
	return (status, ms, source) => {
		const meta = t("trafficLog.detail.meta", { status: String(status), ms });
		return source ? `${meta} · X-Localman-Source: ${source}` : meta;
	};
}

/** Headers, request body, response line and body of a line still loading. */
function LineSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="request-log-detail-loading"
			label={t("trafficLog.detail.loading")}
			className="grid gap-4"
		>
			<Skeleton className="h-3 w-32" />
			<Skeleton variant="text" lines={3} className="max-w-md" />
			<Skeleton className="h-20 w-full" />
			<Skeleton className="h-3 w-24" />
			<Skeleton className="h-3 w-48" />
			<Skeleton className="h-20 w-full" />
		</SkeletonRegion>
	);
}

/** Headers, bodies and response of the selected request, then its replay. */
export function RequestLogDetail({
	projectId,
	id,
	row,
	replay,
}: RequestLogDetailProps) {
	const t = useT();
	const meta = useMeta();
	const rowId = row?.id ?? "";
	const line = useQuery({
		queryKey: ["request-log-line", projectId, rowId],
		queryFn: () => fetchLogLine(projectId, rowId),
		enabled: row !== null,
	});
	const skeleton = useDelayedFlag(row !== null && line.isPending);
	return (
		<section
			id={id}
			aria-label={t("trafficLog.detail.label")}
			className="min-w-0"
		>
			{row === null ? (
				<p className="m-0 text-muted text-sm">{t("trafficLog.detail.pick")}</p>
			) : (
				<Card data-id="request-log-detail" className="grid min-w-0 gap-4 p-4">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<span
							className={cn(
								"font-mono font-semibold text-sm",
								methodClass(row.method),
							)}
						>
							{row.method}
						</span>
						<code className="min-w-0 wrap-anywhere">{fullPath(row)}</code>
						<span className="ml-auto flex items-center gap-2">
							<SourceBadge row={row} />
							<span
								className={cn(
									"font-mono",
									row.status >= 400 ? "text-error-text" : "text-fg",
								)}
							>
								{row.status}
							</span>
						</span>
					</div>
					<LogDeliveryInfo row={row} />
					{skeleton ? (
						<LineSkeleton />
					) : line.isPending ? null : line.isError ? (
						<p className="m-0 text-error-text text-sm" role="alert">
							{t("trafficLog.detail.loadFailed")} {errorMessage(line.error)}
						</p>
					) : (
						<>
							<h3 className={DETAIL_TITLE}>
								{t("trafficLog.detail.requestHeaders")}
							</h3>
							<LogHeaders
								title={t("trafficLog.detail.requestHeaders")}
								headers={line.data.request.headers}
							/>
							<LogBody
								caption={t("trafficLog.detail.requestBody")}
								message={line.data.request}
								data-id="request-log-detail-body"
							/>
							<h3 className={DETAIL_TITLE}>
								{t("trafficLog.detail.response")}
							</h3>
							<p
								data-id="request-log-detail-response"
								className="m-0 font-mono text-muted text-sm"
							>
								{meta(
									line.data.status,
									line.data.ms,
									localmanSource(line.data.response.headers),
								)}
							</p>
							<LogBody
								caption={t("trafficLog.detail.responseBody")}
								message={line.data.response}
								data-id="request-log-detail-response-body"
							/>
							<p className="m-0 text-muted text-xs">
								{t("trafficLog.detail.cutNote")}
							</p>
						</>
					)}
					{replay ? (
						<div
							data-id="request-log-replay-result"
							className="grid gap-2 border-border-subtle border-t pt-4"
						>
							<h3 className={DETAIL_TITLE}>{t("trafficLog.replay.title")}</h3>
							<p className="m-0 font-mono text-muted text-sm">
								{meta(replay.status, replay.ms, replay.source)}
							</p>
							<LogBody
								caption={t("trafficLog.detail.responseBody")}
								message={replay}
								data-id="request-log-replay-body"
							/>
						</div>
					) : null}
				</Card>
			)}
		</section>
	);
}
