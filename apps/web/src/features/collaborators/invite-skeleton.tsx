import { Card } from "../../components/ui/card";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";

/**
 * First load of `/invite/:token` once signed in: the card of
 * `InvitePreviewCard` (project avatar and title, inviter, expiry, the
 * signed-in account, then the accept and back buttons).
 */
export function InviteSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion data-id="invite-page-loading" label={t("invite.loading")}>
			<Card className="mx-auto grid w-full max-w-md gap-4 p-6">
				<div className="flex items-center gap-3">
					<Skeleton className="size-11 shrink-0" />
					<Skeleton className="h-6 w-56 max-w-full" />
				</div>
				<Skeleton className="h-3.5 w-64 max-w-full" />
				<Skeleton className="h-3 w-40" />
				<div className="flex items-center gap-2 rounded-md border border-border-subtle px-3 py-2">
					<Skeleton variant="circle" className="size-8 shrink-0" />
					<Skeleton className="h-3.5 w-48 max-w-full" />
				</div>
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</Card>
		</SkeletonRegion>
	);
}
