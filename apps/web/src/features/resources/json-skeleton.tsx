import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/cn";

/**
 * Indent and width of each placeholder line: an array of two records,
 * as `JSON.stringify(records, null, 2)` lays them out.
 */
const LINES = [
	{ id: "open", indent: "", width: "w-3" },
	{ id: "a-open", indent: "pl-4", width: "w-3" },
	{ id: "a-id", indent: "pl-8", width: "w-28" },
	{ id: "a-name", indent: "pl-8", width: "w-48" },
	{ id: "a-email", indent: "pl-8", width: "w-56" },
	{ id: "a-close", indent: "pl-4", width: "w-4" },
	{ id: "b-open", indent: "pl-4", width: "w-3" },
	{ id: "b-id", indent: "pl-8", width: "w-28" },
	{ id: "b-name", indent: "pl-8", width: "w-40" },
	{ id: "b-email", indent: "pl-8", width: "w-52" },
	{ id: "b-close", indent: "pl-4", width: "w-3" },
	{ id: "close", indent: "", width: "w-3" },
];

/**
 * Placeholder of the records editor in the frame and height of
 * `JsonEditor` (`h-[min(60vh,28rem)]` in the data modal).
 */
export function JsonSkeleton() {
	return (
		<div className="grid h-[min(60vh,28rem)] content-start gap-2.5 overflow-hidden rounded-md border border-border-strong bg-surface p-4">
			{LINES.map((line) => (
				<div key={line.id} className={line.indent}>
					<Skeleton className={cn("h-3", line.width)} />
				</div>
			))}
		</div>
	);
}
