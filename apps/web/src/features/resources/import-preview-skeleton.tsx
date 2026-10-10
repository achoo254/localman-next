import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";

const SCHEMA_ROWS = ["id", "name", "email", "created"];

/**
 * First preview of an import: the name field, then a few schema rows
 * (field, type, Faker method), in the order the real preview shows them.
 */
export function ImportPreviewSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="resource-import-preview-loading"
			label={t("resourceImport.preview.loading")}
			className="grid gap-4"
		>
			<div className="grid gap-2">
				<Skeleton className="h-3 w-28" />
				<Skeleton className="h-10 w-full" />
			</div>
			<Skeleton className="h-3 w-20" />
			<div className="grid gap-3">
				{SCHEMA_ROWS.map((row) => (
					<div key={row} className="grid grid-cols-3 gap-4">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-3 w-28" />
					</div>
				))}
			</div>
		</SkeletonRegion>
	);
}
