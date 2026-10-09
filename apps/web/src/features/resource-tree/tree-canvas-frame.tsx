import { type ReactNode, useMemo } from "react";
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
	const layout = useMemo(() => layoutTree(items, geometry), [items, geometry]);
	const { selected } = connect;
	return (
		<div data-id={dataId} className="grid min-w-0 grid-cols-[minmax(0,1fr)]">
			<p
				aria-live="polite"
				data-id={`${dataId}-hint`}
				className="m-0 px-6 pt-3 text-[0.8125rem] text-muted leading-[1.55]"
			>
				{selected ? (
					<>
						Đang chọn <b className="font-mono text-primary">{selected.name}</b>.
						Bấm chấm tròn bên phải resource đích để lồng vào, hoặc bấm thanh
						“Thêm vào root”. Nhấn Esc để huỷ.
					</>
				) : (
					"Bấm chấm tròn bên trái một resource để chọn, sau đó bấm chấm tròn bên phải của resource khác để lồng vào."
				)}
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
