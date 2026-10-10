import { IconLoader2, IconTrash } from "@tabler/icons-react";
import { IconButton } from "../../../components/ui/icon-button";
import { useT } from "../../../i18n/i18n-context";
import { APP_TIME_ZONE } from "../../../i18n/translate";
import { cn } from "../../../lib/cn";
import { METHOD_TEXT_CLASS, methodShortLabel } from "../../../lib/method-tone";
import { statusTone } from "../response/response-content";
import { RouteMark } from "../routing/route-badge";
import { routeBadgeLabel } from "../routing/route-why";
import type { HistoryEntry } from "./history-api";

const STATUS_TEXT = {
	neutral: "text-muted",
	primary: "text-primary",
	accent: "text-accent",
	info: "text-info-text",
	success: "text-success-text",
	warning: "text-warning-text",
	danger: "text-error-text",
} as const;

const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
	timeZone: APP_TIME_ZONE,
	hour: "2-digit",
	minute: "2-digit",
});

export interface HistoryItemProps {
	entry: HistoryEntry;
	opening: boolean;
	deleting: boolean;
	onOpen: () => void;
	onDelete: () => void;
}

/** One sent request: method, URL, status and time; opens or deletes. */
export function HistoryItem({
	entry,
	opening,
	deleting,
	onOpen,
	onDelete,
}: HistoryItemProps) {
	const t = useT();
	const status = entry.response.status;
	const time = TIME_FORMAT.format(new Date(entry.createdAt));
	return (
		<li className="group flex items-center gap-1 pr-1 hover:bg-fg/6">
			<button
				type="button"
				data-id="sidebar-history-item"
				aria-label={t("apiClientTools.history.open", {
					method: entry.method,
					url: entry.url,
					route: routeBadgeLabel(entry.response.route, undefined, t),
				})}
				aria-busy={opening}
				aria-disabled={opening || undefined}
				title={entry.url}
				// Stays focused while the entry loads; a second press does nothing.
				onClick={() => !opening && onOpen()}
				className="grid min-h-10 min-w-0 flex-1 cursor-pointer grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2 border-0 bg-transparent py-1.5 pl-3 text-left font-mono text-xs focus-visible:shadow-focus-primary focus-visible:outline-none"
			>
				<span className={cn("font-bold", METHOD_TEXT_CLASS[entry.method])}>
					{methodShortLabel(entry.method)}
				</span>
				<span className="truncate text-fg">{entry.url}</span>
				<span className="flex items-center gap-2">
					{opening ? (
						<IconLoader2
							size={14}
							aria-hidden="true"
							className="motion-safe:animate-spin"
						/>
					) : (
						<>
							<RouteMark route={entry.response.route} />
							<span className={STATUS_TEXT[statusTone(status)]}>{status}</span>
						</>
					)}
					<time dateTime={entry.createdAt} className="text-muted">
						{time}
					</time>
				</span>
			</button>
			<IconButton
				size="sm"
				label={t("apiClientTools.history.deleteItem", {
					method: entry.method,
					url: entry.url,
				})}
				icon={<IconTrash size={14} aria-hidden="true" />}
				data-id="sidebar-history-delete"
				loading={deleting}
				onClick={onDelete}
				className={
					deleting
						? undefined
						: "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
				}
			/>
		</li>
	);
}
