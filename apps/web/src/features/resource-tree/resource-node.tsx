import { ExternalLink } from "../../components/ui/external-link";
import { cn } from "../../lib/cn";
import type { Resource } from "../resources/resource-model";
import { GeneratorBar } from "./generator-bar";
import { type NodeAction, NodeActions } from "./node-actions";
import type { TreeGeometry } from "./tree-layout";
import type { ConnectorState } from "./use-tree-connect";

export interface ResourceNodeProps {
	resource: Resource;
	x: number;
	y: number;
	geometry: TreeGeometry;
	/** Mock URL of the collection, opened by the name link. */
	href: string;
	canEdit: boolean;
	selected: boolean;
	/** Name of the selected resource, used in the right connector's label. */
	selectionName: string | null;
	targetState: ConnectorState;
	/** Why the generator is disabled, or null. */
	blockedReason: string | null;
	onSelect: () => void;
	onNest: () => void;
	onGenerate: (count: number) => void;
	onBlocked: () => void;
	onAction: (action: NodeAction) => void;
}

const HANDLE =
	"-translate-x-1/2 -translate-y-1/2 absolute z-2 size-4 cursor-pointer rounded-full border-[1.5px] p-0 " +
	"transition-[background-color,border-color,opacity] before:absolute before:-inset-2.5 before:rounded-full before:content-['']";

/**
 * Card of one resource on the canvas: connectors on both sides, the name
 * as a link to its mock endpoint, the generator bar with the record count
 * and the action row.
 */
export function ResourceNode({
	resource,
	x,
	y,
	geometry,
	href,
	canEdit,
	selected,
	selectionName,
	targetState,
	blockedReason,
	onSelect,
	onNest,
	onGenerate,
	onBlocked,
	onAction,
}: ResourceNodeProps) {
	const { name } = resource;
	const base = `resource-node-${resource.id}`;
	return (
		<div
			data-id={base}
			data-name={name}
			data-selected={selected ? "true" : undefined}
			style={{
				left: x,
				top: y,
				width: geometry.nodeWidth,
				height: geometry.nodeHeight,
			}}
			className={cn(
				"group absolute rounded-md border bg-surface py-2.5 pr-3.5 pl-4.5 shadow-sm transition-[border-color,box-shadow]",
				selected
					? "border-primary ring-3 ring-primary/22"
					: "border-border hover:border-[color-mix(in_srgb,var(--c-primary)_45%,var(--c-border))]",
			)}
		>
			{canEdit ? (
				<button
					type="button"
					aria-pressed={selected}
					aria-label={`Chọn ${name} để di chuyển`}
					data-id={`${base}-select`}
					style={{ top: geometry.handleY }}
					className={cn(
						HANDLE,
						"left-0",
						selected
							? "border-primary bg-primary"
							: "border-icon-muted bg-surface hover:border-primary",
					)}
					onClick={onSelect}
				/>
			) : null}
			<div className="flex h-6 items-center">
				<ExternalLink
					href={href}
					data-id={`${base}-link`}
					title={`Mở ${href}`}
					className="truncate rounded-xs font-bold font-mono text-fg text-sm no-underline hover:text-primary hover:underline"
				>
					{name}
				</ExternalLink>
			</div>
			<div className="mt-2 flex items-center gap-2">
				<GeneratorBar
					value={resource.count}
					label={`Số bản ghi của ${name}`}
					blockedReason={blockedReason}
					onCommit={onGenerate}
					onBlocked={onBlocked}
					data-id={`${base}-bar`}
				/>
				<span
					aria-hidden="true"
					data-id={`${base}-count`}
					className="min-w-7 font-mono font-semibold text-muted text-xs"
				>
					{resource.count}
				</span>
			</div>
			<NodeActions
				name={name}
				canEdit={canEdit}
				onAction={onAction}
				dataIdBase={base}
			/>
			{canEdit ? (
				<button
					type="button"
					aria-label={`Lồng ${selectionName ?? "resource đang chọn"} vào ${name}`}
					aria-disabled={targetState === "invalid" || undefined}
					data-id={`${base}-nest`}
					data-state={targetState}
					style={{ top: geometry.handleY }}
					className={cn(
						HANDLE,
						"left-full",
						targetState === "target" && "border-primary bg-primary",
						targetState === "invalid" &&
							"cursor-not-allowed border-icon-muted bg-surface opacity-30",
						targetState === "idle" &&
							"border-icon-muted bg-surface hover:border-primary",
					)}
					onClick={onNest}
				/>
			) : null}
		</div>
	);
}
