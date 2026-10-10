import { Skeleton, SkeletonRegion } from "../../../components/ui/skeleton";
import { useT } from "../../../i18n/i18n-context";

const ROWS = [0, 1, 2, 3, 4];

/**
 * First load of the history list: a day heading and rows shaped like
 * `HistoryItem` (method, URL, status and time) at the same height.
 */
export function HistorySkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="sidebar-history-loading"
			label={t("apiClientTools.history.loading")}
		>
			<div className="px-3 pt-3 pb-1">
				<Skeleton className="h-3 w-16" />
			</div>
			{ROWS.map((row) => (
				<div
					key={row}
					className="grid min-h-10 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5 pr-10 pl-3"
				>
					<Skeleton className="h-3 w-8" />
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-12" />
				</div>
			))}
		</SkeletonRegion>
	);
}
