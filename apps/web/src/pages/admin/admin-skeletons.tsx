import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";

const ROWS = [0, 1, 2];

export interface AdminListSkeletonProps {
	label: string;
	"data-id": string;
}

/**
 * Rows of an admin list (feedback messages) on first load: a
 * heading line, a text line and the row's buttons, between list borders.
 */
export function AdminListSkeleton({
	label,
	"data-id": dataId,
}: AdminListSkeletonProps) {
	return (
		<SkeletonRegion data-id={dataId} label={label}>
			{ROWS.map((row) => (
				<div
					key={row}
					className="grid gap-3 border-border-subtle border-b px-5 py-4 last:border-b-0"
				>
					<div className="flex items-center gap-2">
						<Skeleton className="h-4 w-48 max-w-full" />
						<Skeleton className="h-5 w-16" />
						<Skeleton className="ml-auto h-3 w-28" />
					</div>
					<Skeleton variant="text" lines={2} />
					<div className="flex justify-end gap-1">
						<Skeleton className="h-8 w-24" />
						<Skeleton className="h-8 w-20" />
					</div>
				</div>
			))}
		</SkeletonRegion>
	);
}
