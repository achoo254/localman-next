import { cardClassName } from "../../components/ui/card";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

const CHANNELS = [0, 1, 2, 3];
const EVENTS = [0, 1, 2];
const BOXES = [0, 1, 2];

/**
 * First load of `/account/notifications`: the channels card (title,
 * description, button per row) and the event × channel table.
 */
export function NotificationSettingsSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="notify-settings-loading"
			label={t("notifications.settings.loading")}
			className="grid gap-6"
		>
			<div className={cn(cardClassName, "grid p-6 pb-3")}>
				<Skeleton className="mb-3 h-5 w-40" />
				{CHANNELS.map((row) => (
					<div
						key={row}
						className="flex items-start justify-between gap-4 border-border-subtle border-t py-3"
					>
						<div className="grid min-w-0 flex-1 gap-2">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-3 w-64 max-w-full" />
						</div>
						<Skeleton className="h-8 w-32 shrink-0" />
					</div>
				))}
			</div>
			<div className={cn(cardClassName, "grid gap-4 p-6")}>
				<Skeleton className="h-5 w-56 max-w-full" />
				{EVENTS.map((row) => (
					<div
						key={row}
						className="flex items-center gap-4 border-border-subtle border-t py-3"
					>
						<Skeleton className="h-4 flex-1" />
						{BOXES.map((box) => (
							<Skeleton key={box} className="mx-6 size-4 shrink-0" />
						))}
					</div>
				))}
			</div>
		</SkeletonRegion>
	);
}
