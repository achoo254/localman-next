import { IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { useSearchParams } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import type { Project } from "../../pages/projects/projects-api";
import { useTrafficSettings } from "../upstream/use-traffic-settings";
import { ClearLogModal } from "./clear-log-modal";
import { LiveStatus, RetentionNote } from "./live-status";
import {
	LOG_FILTER_PARAMS,
	type LogFilters,
	NO_FILTERS,
	filtersActive,
	filtersFromSearch,
} from "./log-filters";
import { requestLogKey } from "./request-log-api";
import { RequestLogDetail } from "./request-log-detail";
import { RequestLogFilters } from "./request-log-filters";
import type { LogSummary, ReplayResult } from "./request-log-parse";
import { RequestLogTable } from "./request-log-table";
import { useRequestLog } from "./use-request-log";
import { useRowActions } from "./use-row-actions";

/**
 * Filters handed over in the page's search parameters (a link from another
 * tab), read once; the parameters are then dropped from the address.
 */
function useInitialFilters(): LogFilters {
	const [params, setParams] = useSearchParams();
	const [initial] = useState(() => filtersFromSearch(params));
	useEffect(() => {
		const names = Object.values(LOG_FILTER_PARAMS);
		if (!names.some((name) => params.has(name))) return;
		setParams(
			(previous) => {
				const next = new URLSearchParams(previous);
				for (const name of names) next.delete(name);
				return next;
			},
			{ replace: true },
		);
	}, [params, setParams]);
	return initial;
}

/**
 * Panel "Request log" of the endpoint card: live table of the requests the
 * mock received, filters, history pages, detail with Replay and "Open in
 * API Client", and "Clear log" for those who manage the project.
 */
export function RequestLogPanel({ project }: { project: Project }) {
	const t = useT();
	const { apiClient } = useFeatures();
	const queryClient = useQueryClient();
	const initialFilters = useInitialFilters();
	const [filters, setFilters] = useState<LogFilters>(initialFilters);
	const [live, setLive] = useState(true);
	const [selected, setSelected] = useState<LogSummary | null>(null);
	const [replays, setReplays] = useState<
		Readonly<Record<string, ReplayResult>>
	>({});
	const [clearing, setClearing] = useState(false);
	const detailId = useId();
	const liveLabelId = useId();
	const settings = useTrafficSettings(project.id);
	const log = useRequestLog(project.id, filters, live);
	const actions = useRowActions(project.id, (row, result) => {
		setSelected(row);
		setReplays((previous) => ({ ...previous, [row.id]: result }));
	});
	// The selected row as last streamed (an inbox forward adds its attempts).
	const shown = selected
		? (log.rows.find((row) => row.id === selected.id) ?? selected)
		: null;
	const canManage = settings.data?.canManage ?? false;
	const history = log.history;
	const announcement = log.live.announcement;

	const onCleared = () => {
		log.live.clear();
		setSelected(null);
		setReplays({});
		void queryClient.resetQueries({ queryKey: requestLogKey(project.id) });
	};

	return (
		<div className="grid min-w-0 gap-4 p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-3">
					<h2 className="m-0 font-mono font-semibold text-[0.8125rem] text-muted">
						{t("trafficLog.title")}
					</h2>
					<LiveStatus state={log.liveState} />
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<span className="flex items-center gap-2">
						<span id={liveLabelId} className="text-muted text-sm">
							{t("trafficLog.liveSwitch")}
						</span>
						<Switch
							checked={live}
							onCheckedChange={setLive}
							aria-labelledby={liveLabelId}
							data-id="request-log-live"
						/>
					</span>
					{canManage ? (
						<Button
							variant="ghost"
							size="sm"
							leadingIcon={<IconTrash size={16} aria-hidden="true" />}
							onClick={() => setClearing(true)}
							data-id="request-log-clear"
						>
							{t("trafficLog.clear.button")}
						</Button>
					) : null}
				</div>
			</div>
			<RequestLogFilters filters={filters} onChange={setFilters} />
			{history.isError && log.rows.length === 0 ? (
				<Alert tone="danger" data-id="request-log-error">
					<p className="m-0">{t("trafficLog.loadFailed")}</p>
					<Button
						size="sm"
						className="mt-2"
						onClick={() => void history.refetch()}
					>
						{t("common.cta.retry")}
					</Button>
				</Alert>
			) : (
				<RequestLogTable
					rows={log.rows}
					loading={history.isPending}
					filtered={filtersActive(filters)}
					baseUrl={project.mockBaseUrl}
					fresh={log.live.fresh}
					selectedId={selected?.id ?? null}
					detailId={detailId}
					busy={actions.busy}
					showOpen={apiClient}
					onSelect={setSelected}
					onAction={actions.run}
					onClearFilters={() => setFilters(NO_FILTERS)}
				/>
			)}
			{history.hasNextPage ? (
				<Button
					size="sm"
					className="justify-self-start"
					disabled={history.isFetchingNextPage}
					onClick={() => void history.fetchNextPage()}
					data-id="request-log-more"
				>
					{history.isFetchingNextPage
						? t("trafficLog.table.loadingMore")
						: t("trafficLog.table.more")}
				</Button>
			) : null}
			<p className="sr-only" aria-live="polite" data-id="request-log-announce">
				{announcement
					? // The trailing space alternates so the same count is read again.
						`${t("trafficLog.announce", { count: announcement.count })}${announcement.seq % 2 ? "" : " "}`
					: ""}
			</p>
			<RequestLogDetail
				projectId={project.id}
				id={detailId}
				row={shown}
				replay={shown ? replays[shown.id] : undefined}
			/>
			{settings.data ? <RetentionNote settings={settings.data} /> : null}
			{canManage ? (
				<ClearLogModal
					projectId={project.id}
					open={clearing}
					onOpenChange={setClearing}
					onCleared={onCleared}
				/>
			) : null}
		</div>
	);
}
