import { Skeleton } from "../../../components/ui/skeleton";

const TABS = [0, 1, 2];
const PARTS = [0, 1, 2, 3, 4];
const ROWS = [0, 1, 2];

/**
 * First load of `/api-client` while the saved drafts come back: the tab
 * bar, the request editor (name, URL bar, part tabs, key/value rows) and
 * the empty response, at their real sizes so nothing jumps. It has no
 * status of its own: the status bar already says "Loading tabs…".
 */
export function WorkbenchSkeleton() {
	return (
		<div
			data-id="workbench-loading"
			aria-busy="true"
			className="flex min-h-0 min-w-0 flex-1 flex-col"
		>
			<div className="flex min-w-0 items-stretch border-border-subtle border-b bg-surface-subtle">
				{TABS.map((tab) => (
					<div
						key={tab}
						className="flex min-h-10 w-36 flex-none items-center gap-2 border-border-subtle border-r px-3"
					>
						<Skeleton className="h-3 w-6 shrink-0" />
						<Skeleton className="h-3 flex-1" />
					</div>
				))}
			</div>
			<div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
				<div className="grid min-w-0 content-start gap-3 p-4">
					<Skeleton className="h-9 w-48 max-w-full" />
					<Skeleton className="h-11 w-full" />
					<div className="flex min-h-11 items-center gap-5 border-border-subtle border-b">
						{PARTS.map((part) => (
							<Skeleton key={part} className="h-3 w-12" />
						))}
					</div>
					{ROWS.map((row) => (
						<Skeleton key={row} className="h-9 w-full" />
					))}
				</div>
				<div className="grid min-h-64 min-w-0 place-items-center content-center gap-3 border-border-subtle px-6 py-12 max-lg:border-t lg:border-l">
					<Skeleton variant="circle" className="size-8" />
					<Skeleton className="h-4 w-40 max-w-full" />
					<Skeleton className="h-3 w-64 max-w-full" />
				</div>
			</div>
		</div>
	);
}
