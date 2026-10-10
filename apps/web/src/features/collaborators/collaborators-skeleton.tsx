import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";

const ROWS = ["owner", "member"];

/**
 * First load of the collaborators dialog: rows in the shape of
 * `CollaboratorRow` (avatar, name, status badge) with its border and
 * padding.
 */
export function CollaboratorsSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="modal-collaborators-loading"
			label={t("collaborators.list.loading")}
			className="grid gap-2"
		>
			{ROWS.map((row) => (
				<div
					key={row}
					className="flex items-center gap-3 rounded-md border border-border-subtle py-2 pr-2 pl-3"
				>
					<Skeleton className="size-8 shrink-0 rounded-sm" />
					<Skeleton className="h-3 w-40 max-w-full" />
					<Skeleton className="ml-auto h-5 w-16 rounded-sm" />
				</div>
			))}
		</SkeletonRegion>
	);
}
