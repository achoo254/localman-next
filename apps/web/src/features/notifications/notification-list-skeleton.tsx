import { Skeleton } from "../../components/ui/skeleton";

const ROWS = [0, 1, 2];

/**
 * Bell entries while the first page loads, shaped like `NotificationItem`
 * (dot, title, body, time). Decorative only: the menu says "Loading…" in a
 * label, since a menu may only hold items, labels and separators.
 */
export function NotificationListSkeleton() {
	return (
		<div aria-hidden="true" data-id="notifications-loading">
			{ROWS.map((row) => (
				<div key={row} className="flex items-start gap-2 px-3 py-2">
					<Skeleton variant="circle" className="mt-1 size-2 shrink-0" />
					<div className="grid min-w-0 flex-1 gap-1.5">
						<Skeleton className="h-3.5 w-44 max-w-full" />
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-24" />
					</div>
				</div>
			))}
		</div>
	);
}
