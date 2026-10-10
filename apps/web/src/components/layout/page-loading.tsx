import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { cardClassName } from "../ui/card";
import { Skeleton, SkeletonRegion } from "../ui/skeleton";

/**
 * Placeholder while a lazily loaded page's code is fetched: a generic page
 * skeleton (title, then a few cards). Nothing appears for the first 150 ms
 * so a cached chunk does not flash it; the route bar runs meanwhile.
 */
export function PageLoading() {
	const t = useT();
	const shown = useDelayedFlag(true);
	if (!shown) return null;
	return (
		<SkeletonRegion
			data-id="page-loading"
			label={t("layout.pageLoading")}
			className="grid gap-5"
		>
			<Skeleton className="h-8 w-48 max-w-full" />
			<Skeleton variant="text" lines={2} className="max-w-md" />
			{[0, 1, 2].map((card) => (
				<div key={card} className={cn(cardClassName, "grid gap-3 p-6")}>
					<Skeleton className="h-5 w-40 max-w-full" />
					<Skeleton variant="text" lines={2} />
				</div>
			))}
		</SkeletonRegion>
	);
}
