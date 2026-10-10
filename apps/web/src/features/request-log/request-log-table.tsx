import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { LogSummary } from "./request-log-parse";
import { RequestLogRow, type RowAction } from "./request-log-row";

const HEAD =
	"whitespace-nowrap px-3 py-2 text-left font-mono font-semibold text-muted text-xs";
const MESSAGE = "px-4 py-8 text-center text-muted text-sm whitespace-normal";
const COLUMNS = 7;

export interface RowBusy {
	id: string;
	action: RowAction;
}

export interface RequestLogTableProps {
	rows: LogSummary[];
	/** The first page is loading. */
	loading: boolean;
	/** Some filter is set (an empty table says so). */
	filtered: boolean;
	/** Mock base URL, for the "no requests yet" hint. */
	baseUrl: string;
	fresh: ReadonlySet<string>;
	selectedId: string | null;
	detailId: string;
	busy: RowBusy | null;
	showOpen: boolean;
	onSelect: (row: LogSummary) => void;
	onAction: (row: LogSummary, action: RowAction) => void;
	onClearFilters: () => void;
}

/** Native table, scrolling sideways inside the card on narrow screens. */
export function RequestLogTable({
	rows,
	loading,
	filtered,
	baseUrl,
	fresh,
	selectedId,
	detailId,
	busy,
	showOpen,
	onSelect,
	onAction,
	onClearFilters,
}: RequestLogTableProps) {
	const t = useT();
	let message = null;
	if (rows.length === 0) {
		message = loading ? (
			<td colSpan={COLUMNS} className={MESSAGE}>
				{t("trafficLog.table.loading")}
			</td>
		) : filtered ? (
			<td
				colSpan={COLUMNS}
				className={MESSAGE}
				data-id="request-log-empty-filtered"
			>
				{t("trafficLog.emptyFiltered")}{" "}
				<Button
					variant="ghost"
					size="sm"
					onClick={onClearFilters}
					data-id="request-log-empty-clear"
				>
					{t("trafficLog.filters.clear")}
				</Button>
			</td>
		) : (
			<td colSpan={COLUMNS} className={MESSAGE} data-id="request-log-empty">
				{renderRich(t("trafficLog.empty", { url: baseUrl }))}
			</td>
		);
	}
	return (
		<div className="min-w-0 overflow-x-auto rounded-md border border-border-subtle">
			<table
				data-id="request-log-table"
				className="w-full border-collapse text-sm"
			>
				<caption className="sr-only">{t("trafficLog.table.caption")}</caption>
				<thead className="bg-surface-subtle">
					<tr>
						<th scope="col" className={HEAD}>
							{t("trafficLog.table.time")}
						</th>
						<th scope="col" className={HEAD}>
							{t("trafficLog.table.method")}
						</th>
						<th scope="col" className={HEAD}>
							{t("trafficLog.table.path")}
						</th>
						<th scope="col" className={HEAD}>
							{t("trafficLog.table.source")}
						</th>
						<th scope="col" className={HEAD}>
							{t("trafficLog.table.status")}
						</th>
						<th scope="col" className={HEAD}>
							{t("trafficLog.table.duration")}
						</th>
						<th scope="col" className={HEAD}>
							<span className="sr-only">{t("trafficLog.table.actions")}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{message ? (
						<tr>{message}</tr>
					) : (
						rows.map((row) => (
							<RequestLogRow
								key={row.id}
								row={row}
								selected={row.id === selectedId}
								fresh={fresh.has(row.id)}
								detailId={detailId}
								busy={busy?.id === row.id ? busy.action : null}
								showOpen={showOpen}
								onSelect={onSelect}
								onAction={onAction}
							/>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}
