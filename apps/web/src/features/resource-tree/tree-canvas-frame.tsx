import { type ReactNode, useMemo } from "react";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import { AddToRootRail } from "./add-to-root-rail";
import {
	type LaidOutNode,
	type TreeGeometry,
	type TreeItem,
	layoutTree,
} from "./tree-layout";
import { useCanvasZoom } from "./use-canvas-zoom";
import { useDragPan } from "./use-drag-pan";
import { type TreeCardBinding, useRovingTree } from "./use-roving-tree";
import type { TreeConnect } from "./use-tree-connect";
import { ZoomToolbar } from "./zoom-toolbar";

export interface TreeCanvasFrameProps<T extends TreeItem> {
	items: readonly T[];
	geometry: TreeGeometry;
	connect: TreeConnect<T>;
	/** `data-id` of the canvas; parts append `-hint`, `-zoom`, `-viewport`, `-item-{id}`. */
	"data-id": string;
	railDataId: string;
	/**
	 * Project page: the viewport is capped to the screen below the top bar
	 * and gets Fit / 100% and drag-to-pan. The landing demo stays small.
	 */
	zoomable?: boolean;
	/** Enter on a focused node. */
	onActivate?: (item: T) => void;
	renderNode: (node: LaidOutNode<T>, tree: TreeCardBinding) => ReactNode;
}

/**
 * Shared body of the resource tree canvases (project page and landing
 * demo): the nesting hint, SVG elbow links under absolutely placed nodes
 * and the root rail. Keyboard users move through a `role="tree"` of empty
 * tree items laid under the cards (one tab stop); Tab steps from the
 * focused item into its card's controls. Wide trees scroll inside the
 * card, never the page; the content scales with a CSS transform inside a
 * sizer of the scaled size, so the scrollbars match.
 */
export function TreeCanvasFrame<T extends TreeItem>({
	items,
	geometry,
	connect,
	"data-id": dataId,
	railDataId,
	zoomable = false,
	onActivate,
	renderNode,
}: TreeCanvasFrameProps<T>) {
	const t = useT();
	const layout = useMemo(() => layoutTree(items, geometry), [items, geometry]);
	const zoom = useCanvasZoom({ width: layout.width, height: layout.height });
	const pan = useDragPan(zoom.viewportRef, zoomable);
	const bind = useRovingTree(layout.nodes, onActivate);
	const entries = layout.nodes.map((node, index) => ({
		node,
		binding: bind(node, index),
	}));
	const { selected } = connect;
	const { scale } = zoom;
	return (
		<div
			data-id={dataId}
			className="grid min-w-0 grid-cols-[minmax(0,1fr)]"
			onKeyDown={(event) => {
				if (event.key === "Escape" && selected) connect.clear();
				else if (zoomable) zoom.onKeyDown(event);
			}}
		>
			<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-3 pt-3 sm:px-6">
				<p
					aria-live="polite"
					data-id={`${dataId}-hint`}
					className="m-0 min-w-0 flex-1 basis-64 text-[0.8125rem] text-muted leading-[1.55]"
				>
					{selected
						? renderRich(
								t("resourceTree.hint.selected", { name: selected.name }),
								{
									b: (name) => <b className="font-mono text-primary">{name}</b>,
								},
							)
						: t("resourceTree.hint.idle")}
				</p>
				{zoomable ? (
					<ZoomToolbar
						mode={zoom.mode}
						onFit={zoom.fit}
						onActual={zoom.actual}
						data-id={`${dataId}-zoom`}
					/>
				) : null}
			</div>
			<div
				ref={zoom.viewportRef}
				data-id={`${dataId}-viewport`}
				className={cn(
					"overflow-auto px-3 pt-4 pb-6 sm:px-6",
					zoomable && "max-h-[calc(100dvh-var(--topbar-h))] cursor-grab",
					pan.panning && "cursor-grabbing select-none",
				)}
				onPointerDown={pan.onPointerDown}
				onPointerMove={pan.onPointerMove}
				onPointerUp={pan.onPointerUp}
				onPointerCancel={pan.onPointerCancel}
			>
				<div
					className="relative"
					style={{ width: layout.width * scale, height: layout.height * scale }}
				>
					<div
						data-id={`${dataId}-content`}
						className="absolute top-0 left-0 origin-top-left motion-safe:transition-transform"
						style={{
							width: layout.width,
							height: layout.height,
							transform: scale === 1 ? undefined : `scale(${scale})`,
						}}
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
						{/* Focus targets only: the cards drawn after them cover them. */}
						<div
							role="tree"
							aria-label={t("resourceTree.tree.label")}
							className="pointer-events-none absolute inset-0"
						>
							{entries.map(({ node, binding }) => (
								<div
									key={node.item.id}
									{...binding.itemProps}
									aria-label={node.item.name}
									data-id={`${dataId}-item-${node.item.id}`}
									className="absolute rounded-md"
									style={{
										left: node.x,
										top: node.y,
										width: geometry.nodeWidth,
										height: geometry.nodeHeight,
									}}
								/>
							))}
						</div>
						{entries.map(({ node, binding }) => renderNode(node, binding))}
					</div>
				</div>
			</div>
		</div>
	);
}
