import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { useDelayedFlag } from "../../lib/use-delayed-flag";

const FIELDS = [0, 1, 2];

/**
 * A modal form whose code or session is still loading (Pro interest,
 * feedback): labelled fields and a message box. Mounted as a Suspense
 * fallback, so it waits 150 ms itself and fast loads show nothing.
 */
export function FormSkeleton({ "data-id": dataId }: { "data-id": string }) {
	const t = useT();
	const shown = useDelayedFlag(true);
	if (!shown) return null;
	return (
		<SkeletonRegion
			data-id={dataId}
			label={t("common.loading")}
			className="grid gap-4"
		>
			{FIELDS.map((field) => (
				<div key={field} className="grid gap-1.5">
					<Skeleton className="h-3 w-28" />
					<Skeleton className="h-10 w-full" />
				</div>
			))}
			<div className="grid gap-1.5">
				<Skeleton className="h-3 w-20" />
				<Skeleton className="h-24 w-full" />
			</div>
		</SkeletonRegion>
	);
}

/**
 * The Turnstile check while its configuration loads, at the widget's
 * size (300 × 65 px) so the form does not jump when it appears.
 */
export function TurnstileSkeleton({
	label,
	"data-id": dataId,
}: {
	label: string;
	"data-id": string;
}) {
	return (
		<SkeletonRegion data-id={dataId} label={label}>
			<Skeleton className="h-16 w-full max-w-75" />
		</SkeletonRegion>
	);
}
