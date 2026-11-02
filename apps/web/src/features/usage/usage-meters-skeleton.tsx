import { cardClassName } from "../../components/ui/card";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { cn } from "../../lib/cn";

export interface UsageMetersSkeletonProps {
	/** How many meters are coming (the proxy meter is behind a flag). */
	count: number;
	/** Read once by screen readers, e.g. "Loading quotas…". */
	label: string;
	"data-id": string;
	className?: string;
}

/** `UsageMeter` cards while the usage loads: label and count, bar, note. */
export function UsageMetersSkeleton({
	count,
	label,
	"data-id": dataId,
	className,
}: UsageMetersSkeletonProps) {
	return (
		<SkeletonRegion data-id={dataId} label={label} className={className}>
			{Array.from({ length: count }, (_, index) => (
				<div
					// Identical placeholders that never reorder.
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
					key={index}
					className={cn(cardClassName, "grid content-start gap-2 p-6")}
				>
					<div className="flex items-baseline justify-between gap-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-16" />
					</div>
					<Skeleton className="h-2 w-full" />
					<Skeleton variant="text" lines={2} />
				</div>
			))}
		</SkeletonRegion>
	);
}
