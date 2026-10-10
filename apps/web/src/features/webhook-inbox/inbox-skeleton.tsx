import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";

const ITEMS = ["first", "second"];

/**
 * First load of the Inbox tab: the count and "New inbox" row, then items
 * in the shape of `InboxItem` (name, answer, actions, URL field).
 */
export function InboxSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="inbox-loading"
			label={t("webhookInbox.loading")}
			className="grid gap-4"
		>
			<div className="flex items-center gap-3">
				<Skeleton className="h-3 w-28" />
				<Skeleton className="h-8 w-28 rounded-sm" />
			</div>
			<div className="grid gap-3">
				{ITEMS.map((item) => (
					<div
						key={item}
						className="grid gap-3 rounded-md border border-border-subtle p-4"
					>
						<div className="flex flex-wrap items-center gap-2">
							<Skeleton className="h-3.5 w-24" />
							<Skeleton className="h-3 w-40 max-w-full" />
							<Skeleton className="ml-auto h-8 w-24 rounded-sm" />
						</div>
						<Skeleton className="h-10 w-full" />
					</div>
				))}
			</div>
		</SkeletonRegion>
	);
}
