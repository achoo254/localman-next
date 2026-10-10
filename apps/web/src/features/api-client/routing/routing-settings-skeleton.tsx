import { Skeleton, SkeletonRegion } from "../../../components/ui/skeleton";
import { useT } from "../../../i18n/i18n-context";

const SECTIONS = [0, 1, 2];

/**
 * First load of the routing settings: the default-route switch and the
 * two host lists (title, hint, rows) in their real spacing.
 */
export function RoutingSettingsSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="settings-routing-loading"
			label={t("apiClientRouting.settings.loading")}
			className="grid gap-5"
		>
			{SECTIONS.map((section) => (
				<div key={section} className="grid gap-2">
					<Skeleton className="h-4 w-36" />
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
			))}
		</SkeletonRegion>
	);
}
