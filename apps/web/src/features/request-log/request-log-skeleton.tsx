import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/cn";
import { CELL } from "./request-log-row";

const ROWS = ["first", "second", "third", "fourth", "fifth"];

/** Width of the placeholder in each column, as the real cells read. */
const COLUMNS = [
	{ id: "time", width: "w-14" },
	{ id: "method", width: "w-10" },
	{ id: "path", width: "w-40" },
	{ id: "source", width: "w-14" },
	{ id: "status", width: "w-8" },
	{ id: "ms", width: "w-10" },
	{ id: "actions", width: "w-20" },
];

/**
 * First page of the request log: rows of placeholder cells under the real
 * header, at the height of `RequestLogRow`. The table around them is
 * wrapped in a `SkeletonRegion`.
 */
export function RequestLogSkeletonRows() {
	return (
		<>
			{ROWS.map((row) => (
				<tr
					key={row}
					data-id="request-log-skeleton-row"
					className="border-border-subtle border-t"
				>
					{COLUMNS.map((column) => (
						<td key={column.id} className={CELL}>
							<div className="flex min-h-8 items-center">
								<Skeleton className={cn("h-3", column.width)} />
							</div>
						</td>
					))}
				</tr>
			))}
		</>
	);
}
