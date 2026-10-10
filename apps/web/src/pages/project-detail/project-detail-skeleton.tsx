import { cardClassName } from "../../components/ui/card";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useFeatures } from "../../config/features";
import { TreeSkeleton } from "../../features/resource-tree/tree-skeleton";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

const FOOTER_BUTTONS = ["new", "generate", "reset"];
const TABS = ["rest", "mcp", "upstream"];

/**
 * First load of `/projects/:projectId`: breadcrumb with the member
 * buttons, the API endpoint card (tabs when released, URL, action footer)
 * and the resources card with a tree-shaped placeholder, at the real
 * paddings so the page does not jump when the project arrives.
 */
export function ProjectDetailSkeleton() {
	const t = useT();
	const flags = useFeatures();
	const tabs = flags.mockMcp || flags.hybridMock;
	return (
		<SkeletonRegion
			data-id="project-detail-loading"
			label={t("projectDetail.loading")}
			className="grid grid-cols-[minmax(0,1fr)] gap-6"
		>
			<div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-6 w-40" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-8 w-32 rounded-sm" />
					<Skeleton className="h-8 w-28 rounded-sm" />
				</div>
			</div>
			<div className={cn(cardClassName, "min-w-0 overflow-hidden")}>
				{tabs ? (
					<div className="flex min-h-11 items-center gap-6 border-border-subtle border-b px-6">
						{TABS.map((tab) => (
							<Skeleton key={tab} className="h-3 w-14" />
						))}
					</div>
				) : null}
				<div className="grid gap-3 p-6">
					<Skeleton className="h-3 w-24" />
					<Skeleton className="h-7 w-full max-w-xl" />
				</div>
				<div className="flex flex-wrap gap-2 border-border-subtle border-t bg-surface-subtle px-6 py-3">
					{FOOTER_BUTTONS.map((button) => (
						<Skeleton key={button} className="h-10 w-32" />
					))}
				</div>
			</div>
			<div className={cn(cardClassName, "min-w-0 overflow-hidden")}>
				<div className="flex items-center border-border-subtle border-b px-6 py-4">
					<Skeleton className="h-4 w-24" />
				</div>
				<TreeSkeleton />
			</div>
		</SkeletonRegion>
	);
}
