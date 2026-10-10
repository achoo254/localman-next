import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";

const OPTIONS = ["none", "tunnel", "url"];
const CHIPS = ["authorization", "cookie", "x-api-key"];

/**
 * First load of the Upstream panel: the three choice cards of
 * `UpstreamOption`, the save row, then the masked header chips.
 */
export function UpstreamSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="project-detail-upstream-loading"
			label={t("upstream.loading")}
			className="grid gap-6"
		>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
				{OPTIONS.map((option) => (
					<div
						key={option}
						className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4"
					>
						<Skeleton variant="circle" className="mt-1 size-4 shrink-0" />
						<div className="grid flex-1 gap-2">
							<Skeleton className="h-3.5 w-24" />
							<Skeleton variant="text" lines={2} />
						</div>
					</div>
				))}
			</div>
			<div className="flex items-center gap-3">
				<Skeleton className="h-10 w-24" />
				<Skeleton className="h-3 w-48 max-w-full" />
			</div>
			<div className="grid gap-3 border-border-subtle border-t pt-6">
				<Skeleton className="h-3 w-32" />
				<div className="flex flex-wrap gap-2">
					{CHIPS.map((chip) => (
						<Skeleton key={chip} className="h-8 w-28 rounded-sm" />
					))}
				</div>
			</div>
		</SkeletonRegion>
	);
}
