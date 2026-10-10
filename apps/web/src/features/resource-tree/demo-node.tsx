import { cn } from "../../lib/cn";
import { NestConnector, SelectConnector } from "./node-connectors";
import type { TreeGeometry, TreeItem } from "./tree-layout";
import type { TreeCardBinding } from "./use-roving-tree";
import type { ConnectorState } from "./use-tree-connect";

export interface DemoNodeProps {
	item: TreeItem;
	x: number;
	y: number;
	geometry: TreeGeometry;
	selected: boolean;
	selectionName: string | null;
	targetState: ConnectorState;
	/** Focus state and roving tabindex of the node, from the canvas tree. */
	tree: TreeCardBinding;
	onSelect: () => void;
	onNest: () => void;
}

/**
 * Node of the landing demo: the name and the two connectors, without the
 * mock link, generator bar or action row of the project page.
 */
export function DemoNode({
	item,
	x,
	y,
	geometry,
	selected,
	selectionName,
	targetState,
	tree,
	onSelect,
	onNest,
}: DemoNodeProps) {
	const base = `demo-node-${item.name}`;
	return (
		<div
			{...tree.cardProps}
			data-tree-node=""
			data-id={base}
			data-selected={selected ? "true" : undefined}
			style={{
				left: x,
				top: y,
				width: geometry.nodeWidth,
				height: geometry.nodeHeight,
			}}
			className={cn(
				"absolute flex items-center rounded-md border bg-surface px-4.5 shadow-sm transition-[border-color,box-shadow]",
				selected
					? "border-primary ring-3 ring-primary/22"
					: "border-border hover:border-[color-mix(in_srgb,var(--c-primary)_45%,var(--c-border))]",
			)}
		>
			<SelectConnector
				name={item.name}
				selected={selected}
				top={geometry.handleY}
				data-id={`${base}-select`}
				tabIndex={tree.innerTabIndex}
				onSelect={onSelect}
			/>
			<span className="truncate font-bold font-mono text-fg text-sm">
				{item.name}
			</span>
			<NestConnector
				name={item.name}
				selectionName={selectionName}
				state={targetState}
				top={geometry.handleY}
				data-id={`${base}-nest`}
				tabIndex={tree.innerTabIndex}
				onNest={onNest}
			/>
		</div>
	);
}
