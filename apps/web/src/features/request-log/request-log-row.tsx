import { IconRefresh, IconSend } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { APP_TIME_ZONE } from "../../i18n/translate";
import { cn } from "../../lib/cn";
import { METHOD_TEXT_CLASS } from "../../lib/method-tone";
import type { LogSummary } from "./request-log-parse";
import { SourceBadge } from "./source-badge";

const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
	timeZone: APP_TIME_ZONE,
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});

export const CELL = "whitespace-nowrap px-3 py-2 align-middle";

/** `HH:mm:ss` in Asia/Saigon, or "" for a malformed time. */
export function logTime(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? "" : TIME_FORMAT.format(date);
}

/** Path with its query, as the request was sent. */
export function fullPath(row: Pick<LogSummary, "path" | "query">): string {
	return row.query ? `${row.path}?${row.query}` : row.path;
}

/** Colour of a method; other methods stay muted. */
export function methodClass(method: string): string {
	const entry = Object.entries(METHOD_TEXT_CLASS).find(
		([name]) => name === method,
	);
	return entry ? entry[1] : "text-muted";
}

export type RowAction = "replay" | "open";

export interface RequestLogRowProps {
	row: LogSummary;
	selected: boolean;
	fresh: boolean;
	/** Id of the detail region the path button shows. */
	detailId: string;
	/** Action of this row in flight, if any. */
	busy: RowAction | null;
	/** The API client is released: show "Open in API Client". */
	showOpen: boolean;
	onSelect: (row: LogSummary) => void;
	onAction: (row: LogSummary, action: RowAction) => void;
}

/** One request: time, method, path (opens the detail), source, status, ms. */
export function RequestLogRow({
	row,
	selected,
	fresh,
	detailId,
	busy,
	showOpen,
	onSelect,
	onAction,
}: RequestLogRowProps) {
	const t = useT();
	const path = fullPath(row);
	const target = { method: row.method, path };
	return (
		<tr
			data-id="request-log-row"
			data-fresh={fresh || undefined}
			className={cn(
				"border-border-subtle border-t transition-colors duration-300 motion-reduce:transition-none",
				selected
					? "bg-primary/8"
					: fresh
						? "motion-safe:bg-primary/12"
						: "hover:bg-fg/4",
			)}
		>
			<td className={cn(CELL, "font-mono text-muted text-xs")}>
				<time dateTime={row.at}>{logTime(row.at)}</time>
			</td>
			<td
				className={cn(
					CELL,
					"font-mono font-semibold text-xs",
					methodClass(row.method),
				)}
			>
				{row.method}
			</td>
			<td className={CELL}>
				<button
					type="button"
					data-id="request-log-path"
					aria-pressed={selected}
					aria-controls={detailId}
					title={path}
					onClick={() => onSelect(row)}
					className="block max-w-56 cursor-pointer truncate rounded-sm border-0 bg-transparent p-0 text-left font-mono text-fg text-sm focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
				>
					{path}
				</button>
			</td>
			<td className={CELL}>
				<SourceBadge row={row} />
			</td>
			<td
				className={cn(
					CELL,
					"font-mono",
					row.status >= 400 ? "text-error-text" : "text-fg",
				)}
			>
				{row.status}
			</td>
			<td className={cn(CELL, "font-mono text-muted")}>
				{t("trafficLog.table.ms", { ms: row.ms })}
			</td>
			<td className={CELL}>
				<span className="flex gap-1">
					{/* A callback went out of the mock: there is nothing to send to it again. */}
					{row.source === "callback" ? null : (
						<Button
							variant="ghost"
							size="sm"
							aria-label={t("trafficLog.actions.replayAria", target)}
							leadingIcon={<IconRefresh size={16} aria-hidden="true" />}
							loading={busy === "replay"}
							onClick={() => onAction(row, "replay")}
							data-id="request-log-replay"
						>
							{t("trafficLog.actions.replay")}
						</Button>
					)}
					{showOpen ? (
						<Button
							variant="ghost"
							size="sm"
							aria-label={t("trafficLog.actions.openClientAria", target)}
							leadingIcon={<IconSend size={16} aria-hidden="true" />}
							disabled={busy !== null}
							onClick={() => onAction(row, "open")}
							data-id="request-log-open-client"
						>
							{t("trafficLog.actions.openClient")}
						</Button>
					) : null}
				</span>
			</td>
		</tr>
	);
}
