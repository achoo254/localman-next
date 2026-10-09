import { type ReactNode, useMemo } from "react";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { AddToRootRail } from "./add-to-root-rail";
import {
	type LaidOutNode,
	type TreeGeometry,
	type TreeItem,
	layoutTree,
} from "./tree-layout";
import type { TreeConnect } from "./use-tree-connect";

export interface TreeCanvasFrameProps<T extends TreeItem> {
	items: readonly T[];
	geometry: TreeGeometry;
	connect: TreeConnect<T>;
	/** `data-id` of the canvas; the hint appends `-hint`. */
	"data-id": string;
	railDataId: string;
	renderNode: (node: LaidOutNode<T>) => ReactNode;
}

/**
 * Shared body of the resource tree canvases (project page and landing
 * demo): the nesting hint, SVG elbow links under absolutely placed nodes
 * and the root rail. Wide trees scroll inside the card, never the page.
 */
export function TreeCanvasFrame<T extends TreeItem>({
	items,
	geometry,
	connect,
	"data-id": dataId,
	railDataId,
	renderNode,
}: TreeCanvasFrameProps<T>) {
	const t = useT();
	const layout = useMemo(() => layoutTree(items, geometry), [items, geometry]);
	const { selected } = connect;
	return (
		<div data-id={dataId} className="grid min-w-0 grid-cols-[minmax(0,1fr)]">
			<p
				aria-live="polite"
				data-id={`${dataId}-hint`}
				className="m-0 px-6 pt-3 text-[0.8125rem] text-muted leading-[1.55]"
			>
				{selected
					? renderRich(
							t("resourceTree.hint.selected", { name: selected.name }),
							{ b: (name) => <b className="font-mono text-primary">{name}</b> },
						)
					: t("resourceTree.hint.idle")}
			</p>
			<div
				className="overflow-x-auto px-6 pt-4 pb-6"
				onKeyDown={(event) => {
					if (event.key === "Escape" && selected) connect.clear();
				}}
			>
				<div
					className="relative"
					style={{ width: layout.width, height: layout.height }}
				>
					<svg
						width={layout.width}
						height={layout.height}
						aria-hidden="true"
						focusable="false"
						className="pointer-events-none absolute inset-0 overflow-visible text-icon-muted"
					>
						{layout.links.map((link) => (
							<path
								key={link.childId}
								d={link.path}
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
							/>
						))}
					</svg>
					<AddToRootRail
						width={geometry.railWidth}
						height={layout.height}
						active={connect.rootActive}
						onClick={() => connect.connect(null)}
						data-id={railDataId}
					/>
					{layout.nodes.map(renderNode)}
				</div>
			</div>
		</div>
	);
}
