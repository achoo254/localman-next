import { cardClassName } from "../../components/ui/card";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { cn } from "../../lib/cn";

const KPIS = [0, 1, 2];
const CHARTS = [0, 1];
const BARS = [0, 1, 2, 3];
const ROWS = [0, 1, 2];

/** Pro interest statistics loading: three KPI cards and two bar charts. */
export function ProInterestStatsSkeleton({ label }: { label: string }) {
	return (
		<SkeletonRegion
			data-id="admin-pro-stats-loading"
			label={label}
			className="grid gap-4"
		>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
				{KPIS.map((kpi) => (
					<div key={kpi} className={cn(cardClassName, "grid gap-2 px-6 py-4")}>
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-9 w-16" />
					</div>
				))}
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				{CHARTS.map((chart) => (
					<div
						key={chart}
						className={cn(cardClassName, "grid content-start gap-3 p-6")}
					>
						<Skeleton className="h-4 w-28" />
						{BARS.map((bar) => (
							<div
								key={bar}
								className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2.5rem] items-center gap-2"
							>
								<Skeleton className="h-3 w-24" />
								<Skeleton className="h-2.5 w-full" />
								<Skeleton className="h-3 w-6 justify-self-end" />
							</div>
						))}
					</div>
				))}
			</div>
		</SkeletonRegion>
	);
}

export interface AdminListSkeletonProps {
	label: string;
	"data-id": string;
}

/**
 * Rows of an admin list (sign-ups, feedback messages) on first load: a
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
