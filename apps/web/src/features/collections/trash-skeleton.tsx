import { cardClassName } from "../../components/ui/card";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

const ROWS = [0, 1, 2];

/** First load of the Trash: rows shaped like the table's. */
export function TrashSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="trash-loading"
			label={t("collections.trash.loading")}
			className={cn(cardClassName, "grid overflow-hidden")}
		>
			{ROWS.map((row) => (
				<div
					key={row}
					className="grid gap-2 border-border-subtle border-b p-3 last:border-b-0 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-center"
				>
					<Skeleton className="h-4 w-40 max-w-full" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-8 w-48 max-w-full" />
				</div>
			))}
		</SkeletonRegion>
	);
}
