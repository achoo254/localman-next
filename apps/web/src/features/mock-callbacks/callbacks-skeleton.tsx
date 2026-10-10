import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";

/**
 * First load of the resource form's callbacks: the save note and one
 * callback in the shape of `CallbackItem` (switch, method, event, target,
 * body), then the Add / Save row.
 */
export function CallbacksSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="resource-form-callbacks-loading"
			label={t("mockCallbacks.loading")}
			className="grid gap-3"
		>
			<Skeleton className="h-3 w-72 max-w-full" />
			<div className="grid gap-3 rounded-md border border-border-subtle p-3">
				<div className="flex items-center gap-2">
					<Skeleton className="h-5 w-9 rounded-full" />
					<Skeleton className="h-3 w-10" />
					<Skeleton className="h-9 w-32" />
				</div>
				<Skeleton className="h-3 w-24" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-20 w-full" />
			</div>
			<div className="flex gap-2">
				<Skeleton className="h-8 w-28 rounded-sm" />
				<Skeleton className="h-8 w-20 rounded-sm" />
			</div>
		</SkeletonRegion>
	);
}
