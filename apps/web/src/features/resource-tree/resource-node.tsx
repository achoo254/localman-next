import type { ReactNode } from "react";
import { ExternalLink } from "../../components/ui/external-link";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import type { Resource } from "../resources/resource-model";
import { GeneratorBar } from "./generator-bar";
import { type NodeAction, NodeActions } from "./node-actions";
import { NestConnector, SelectConnector } from "./node-connectors";
import type { TreeGeometry } from "./tree-layout";
import type { ConnectorState } from "./use-tree-connect";

export interface ResourceNodeProps {
	resource: Resource;
	x: number;
	y: number;
	geometry: TreeGeometry;
	/** Mock URL of the collection, opened by the name link. */
	href: string;
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
	/** Opens the resource in the API client; absent hides the action. */
	onOpenInClient?: () => void;
	/** Extra control at the end of the action row. */
	trailingAction?: ReactNode;
}

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
	selected,
	selectionName,
	targetState,
	blockedReason,
	onSelect,
	onNest,
	onGenerate,
	onBlocked,
	onAction,
	onOpenInClient,
	trailingAction,
}: ResourceNodeProps) {
	const t = useT();
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
			<SelectConnector
				name={name}
				selected={selected}
				top={geometry.handleY}
				data-id={`${base}-select`}
				onSelect={onSelect}
			/>
			<div className="flex h-6 items-center">
				<ExternalLink
					href={href}
					data-id={`${base}-link`}
					title={t("resourceTree.node.open", { url: href })}
					className="truncate rounded-xs font-bold font-mono text-fg text-sm no-underline hover:text-primary hover:underline"
				>
					{name}
				</ExternalLink>
			</div>
			<div className="mt-2 flex items-center gap-2">
				<GeneratorBar
					value={resource.count}
					label={t("resourceTree.generator.label", { name })}
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
				onAction={onAction}
				dataIdBase={base}
				onOpenInClient={onOpenInClient}
				trailing={trailingAction}
			/>
			<NestConnector
				name={name}
				selectionName={selectionName}
				state={targetState}
				top={geometry.handleY}
				data-id={`${base}-nest`}
				onNest={onNest}
			/>
		</div>
	);
}
