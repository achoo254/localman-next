import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";

/**
 * First load of the magic link dialog: the status box of
 * `MagicLinkStatus` (badge, expiry, note) at its border and padding.
 */
export function MagicLinkSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="modal-magic-link-loading"
			label={t("collaborators.magic.loading")}
			className="grid gap-2 rounded-md border border-border-subtle px-3 py-2"
		>
			<div className="flex items-center gap-2">
				<Skeleton className="h-5 w-16 rounded-sm" />
				<Skeleton className="h-3 w-44 max-w-full" />
			</div>
			<Skeleton className="h-3 w-64 max-w-full" />
		</SkeletonRegion>
	);
}
