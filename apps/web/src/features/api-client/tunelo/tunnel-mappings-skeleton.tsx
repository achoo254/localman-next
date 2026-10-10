import { Skeleton, SkeletonRegion } from "../../../components/ui/skeleton";
import { useT } from "../../../i18n/i18n-context";

const ROWS = [0, 1];

/** The mappings section while the settings load: title, hint and two cards. */
export function TunnelMappingsSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="settings-tunelo-mappings-loading"
			label={t("apiClientTunelo.mappings.loading")}
			className="grid gap-2"
		>
			<Skeleton className="h-4 w-28" />
			<Skeleton className="h-3 w-full" />
			{ROWS.map((row) => (
				<div
					key={row}
					className="grid gap-1 rounded-md border border-border-subtle bg-surface p-2"
				>
					<div className="flex min-h-8 items-center justify-between gap-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton variant="circle" className="h-5 w-9 shrink-0" />
					</div>
					<Skeleton className="h-3 w-48 max-w-full" />
				</div>
			))}
		</SkeletonRegion>
	);
}
