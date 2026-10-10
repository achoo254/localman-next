import { ExternalLink } from "../../components/ui/external-link";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { middleEllipsisParts } from "../../lib/middle-ellipsis";
import type { Resource } from "../resources/resource-model";
import { GeneratorBar } from "./generator-bar";
import { type NodeAction, NodeActions } from "./node-actions";
import { NestConnector, SelectConnector } from "./node-connectors";
import type { TreeGeometry } from "./tree-layout";
import type { TreeCardBinding } from "./use-roving-tree";
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
	/** Focus state and roving tabindex of the node, from the canvas tree. */
	tree: TreeCardBinding;
	onSelect: () => void;
	onNest: () => void;
	onGenerate: (count: number) => void;
	onBlocked: () => void;
	onAction: (action: NodeAction) => void;
	/** Opens the resource in the API client; absent hides the action. */
	onOpenInClient?: () => void;
	/** "Export types" in the ⋯ menu; absent hides it. */
	exportOf?: { resource: Resource; resources: readonly Resource[] };
}

/**
 * Card of one resource on the canvas: connectors on
 * both sides, the name as a link to its mock endpoint (a long name loses
 * its middle, not its distinct end; the full name stays its text and
 * tooltip), the generator bar with the record count and the action row.
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
	tree,
	onSelect,
	onNest,
	onGenerate,
	onBlocked,
	onAction,
	onOpenInClient,
	exportOf,
}: ResourceNodeProps) {
	const t = useT();
	const { name } = resource;
	const base = `resource-node-${resource.id}`;
	const { head, tail } = middleEllipsisParts(name);
	const inner = tree.innerTabIndex;
	return (
		<div
			{...tree.cardProps}
			data-tree-node=""
			data-focused={tree.focused ? "true" : undefined}
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
				"group absolute cursor-default rounded-md border bg-surface py-2.5 pr-3.5 pl-4.5 shadow-sm transition-[border-color,box-shadow]",
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
				tabIndex={inner}
				onSelect={onSelect}
			/>
			<div className="flex h-6 items-center">
				<ExternalLink
					href={href}
					data-id={`${base}-link`}
					tabIndex={inner}
					// Browsers may read the two halves as two words; the label keeps one.
					aria-label={tail ? name : undefined}
					title={`${name}\n${t("resourceTree.node.open", { url: href })}`}
					className="flex min-w-0 rounded-xs font-bold font-mono text-fg text-sm no-underline hover:text-primary hover:underline"
				>
					<span className="truncate">{head}</span>
					{tail ? <span className="shrink-0">{tail}</span> : null}
				</ExternalLink>
			</div>
			<div className="mt-2 flex items-center gap-2">
				<GeneratorBar
					value={resource.count}
					label={t("resourceTree.generator.label", { name })}
					blockedReason={blockedReason}
					onCommit={onGenerate}
					onBlocked={onBlocked}
					tabIndex={inner}
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
				tabIndex={inner}
				onOpenInClient={onOpenInClient}
				exportOf={exportOf}
			/>
			<NestConnector
				name={name}
				selectionName={selectionName}
				state={targetState}
				top={geometry.handleY}
				data-id={`${base}-nest`}
				tabIndex={inner}
				onNest={onNest}
			/>
		</div>
	);
}
