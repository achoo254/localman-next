import { Skeleton } from "../../components/ui/skeleton";
import { TREE_GEOMETRY, layoutTree } from "./tree-layout";

const GEOMETRY = TREE_GEOMETRY;

/**
 * A small typical tree laid out by the real layout: a root with one child,
 * then a second root. Same node size, rows and links as the canvas, so the
 * card keeps about its height when the resources arrive.
 */
const SHAPE = layoutTree(
	[
		{ id: "first", parentId: null, name: "" },
		{ id: "child", parentId: "first", name: "" },
		{ id: "second", parentId: null, name: "" },
	],
	GEOMETRY,
);

/**
 * First load of the resource tree canvas: the hint line, the root rail,
 * elbow links and node cards holding a name and a generator bar. Purely
 * visual; the caller wraps it in a `SkeletonRegion`.
 */
export function TreeSkeleton() {
	return (
		<div
			aria-hidden="true"
			data-id="resource-tree-skeleton"
			className="grid min-w-0 grid-cols-[minmax(0,1fr)]"
		>
			<div className="flex h-5 items-center px-6 pt-3">
				<Skeleton className="h-3 w-80 max-w-full" />
			</div>
			<div className="overflow-hidden px-6 pt-4 pb-6">
				<div
					className="relative"
					style={{ width: SHAPE.width, height: SHAPE.height }}
				>
					<svg
						width={SHAPE.width}
						height={SHAPE.height}
						aria-hidden="true"
						focusable="false"
						className="pointer-events-none absolute inset-0 overflow-visible text-border"
					>
						{SHAPE.links.map((link) => (
							<path
								key={link.childId}
								d={link.path}
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
							/>
						))}
					</svg>
					<div
						className="absolute top-0 left-0"
						style={{ width: GEOMETRY.railWidth, height: SHAPE.height }}
					>
						<Skeleton className="size-full rounded-sm" />
					</div>
					{SHAPE.nodes.map(({ item, x, y }) => (
						<div
							key={item.id}
							className="absolute rounded-md border border-border bg-surface py-2.5 pr-3.5 pl-4.5"
							style={{
								left: x,
								top: y,
								width: GEOMETRY.nodeWidth,
								height: GEOMETRY.nodeHeight,
							}}
						>
							<div className="flex h-6 items-center">
								<Skeleton className="h-3.5 w-24" />
							</div>
							<div className="mt-2 flex items-center gap-2">
								<Skeleton className="h-6 w-26 rounded-xs" />
								<Skeleton className="h-3 w-6" />
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
