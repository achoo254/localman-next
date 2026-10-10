import { cardClassName } from "../../components/ui/card";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

const ROWS = [0, 1, 2];

/**
 * First load of `/projects`: three cards in the shape of `ProjectRow`
 * (avatar, name, URL line, menu button) so the list does not jump when the
 * data arrives.
 */
export function ProjectsSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="projects-loading"
			label={t("projects.list.loading")}
			className="grid gap-3"
		>
			{ROWS.map((row) => (
				<div
					key={row}
					className={cn(
						cardClassName,
						"flex items-center gap-2 py-2 pr-2 pl-3",
					)}
				>
					<div className="flex min-w-0 flex-1 items-center gap-3 p-2">
						<Skeleton className="size-11 shrink-0" />
						<div className="grid min-w-0 flex-1 gap-2">
							<Skeleton className="h-4 w-40 max-w-full" />
							<Skeleton className="h-3 w-72 max-w-full" />
						</div>
					</div>
					<Skeleton className="size-9 shrink-0" />
				</div>
			))}
		</SkeletonRegion>
	);
}
