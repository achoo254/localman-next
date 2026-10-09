import { useMemo } from "react";
import { useToast } from "../../components/ui/toast";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { ExportTypesMenu } from "../resources/export-types-menu";
import type { Resource } from "../resources/resource-model";
import { DemoNode } from "./demo-node";
import type { NodeAction } from "./node-actions";
import { ResourceNode } from "./resource-node";
import { TreeCanvasFrame } from "./tree-canvas-frame";
import {
	DEMO_TREE_GEOMETRY,
	TREE_GEOMETRY,
	type TreeItem,
} from "./tree-layout";
import { useTreeConnect } from "./use-tree-connect";

/** Project page: real resources with generator, actions and mock links. */
export interface AppTreeCanvasProps {
	mode?: "app";
	resources: readonly Resource[];
	/** Project mock base URL, prefix included. */
	mockBaseUrl: string;
	onGenerate: (resource: Resource, count: number) => void;
	onAction: (action: NodeAction, resource: Resource) => void;
	onMove: (resource: Resource, target: Resource | null) => void;
	/** "API Client" action of each node; absent hides it. */
	onOpenInClient?: (resource: Resource) => void;
}

/**
 * Landing demo: names only, smaller geometry, and moves stay in the
 * caller's client state (no API call).
 */
export interface DemoTreeCanvasProps {
	mode: "demo";
	resources: readonly TreeItem[];
	onMove: (moving: TreeItem, target: TreeItem | null) => void;
}

export type ResourceTreeCanvasProps = AppTreeCanvasProps | DemoTreeCanvasProps;

export function mockUrlOf(mockBaseUrl: string, name: string): string {
	return `${mockBaseUrl.replace(/\/+$/, "")}/${encodeURIComponent(name)}`;
}

/**
 * Resource tree: nest a resource by clicking its left connector, then the
 * right connector of the target (or the "Add to root" rail). Refused
 * moves (cycle, name clash, too deep) are explained in a toast.
 */
export function ResourceTreeCanvas(props: ResourceTreeCanvasProps) {
	return props.mode === "demo" ? (
		<DemoTreeCanvas {...props} />
	) : (
		<AppTreeCanvas {...props} />
	);
}

function DemoTreeCanvas({ resources, onMove }: DemoTreeCanvasProps) {
	const toast = useToast();
	const connect = useTreeConnect(resources, {
		onMove,
		onRefuse: (title, tone) => toast.show({ title, tone }),
	});
	const { selected } = connect;
	return (
		<TreeCanvasFrame
			items={resources}
			geometry={DEMO_TREE_GEOMETRY}
			connect={connect}
			data-id="demo-tree"
			railDataId="demo-node-root"
			renderNode={({ item, x, y }) => (
				<DemoNode
					key={item.id}
					item={item}
					x={x}
					y={y}
					geometry={DEMO_TREE_GEOMETRY}
					selected={selected?.id === item.id}
					selectionName={selected?.name ?? null}
					targetState={connect.targetState(item.id)}
					onSelect={() => connect.toggle(item.id)}
					onNest={() => connect.connect(item.id)}
				/>
			)}
		/>
	);
}

function AppTreeCanvas({
	resources,
	mockBaseUrl,
	onGenerate,
	onAction,
	onMove,
	onOpenInClient,
}: AppTreeCanvasProps) {
	const t = useT();
	const toast = useToast();
	const { mockPowerUps } = useFeatures();
	const byId = useMemo(
		() => new Map(resources.map((resource) => [resource.id, resource])),
		[resources],
	);
	const connect = useTreeConnect(resources, {
		onMove,
		onRefuse: (title, tone) => toast.show({ title, tone }),
	});
	const { selected } = connect;

	function parentOf(resource: Resource): Resource | undefined {
		return resource.parentId ? byId.get(resource.parentId) : undefined;
	}

	function blockedReason(resource: Resource): string | null {
		const parent = parentOf(resource);
		return parent && parent.count === 0
			? t("resourceTree.generator.blockedReason", { parent: parent.name })
			: null;
	}

	function blocked(resource: Resource) {
		toast.show({
			tone: "error",
			title: t("resourceTree.generator.blockedToast", {
				parent:
					parentOf(resource)?.name ??
					t("resourceTree.generator.parentFallback"),
				name: resource.name,
			}),
		});
	}

	return (
		<TreeCanvasFrame
			items={resources}
			geometry={TREE_GEOMETRY}
			connect={connect}
			data-id="resource-tree"
			railDataId="resource-tree-root"
			renderNode={({ item, x, y }) => (
				<ResourceNode
					key={item.id}
					resource={item}
					x={x}
					y={y}
					geometry={TREE_GEOMETRY}
					href={mockUrlOf(mockBaseUrl, item.name)}
					selected={selected?.id === item.id}
					selectionName={selected?.name ?? null}
					targetState={connect.targetState(item.id)}
					blockedReason={blockedReason(item)}
					onSelect={() => connect.toggle(item.id)}
					onNest={() => connect.connect(item.id)}
					onGenerate={(count) => onGenerate(item, count)}
					onBlocked={() => blocked(item)}
					onAction={(action) => onAction(action, item)}
					onOpenInClient={
						onOpenInClient ? () => onOpenInClient(item) : undefined
					}
					trailingAction={
						mockPowerUps ? (
							<ExportTypesMenu
								resource={item}
								resources={resources}
								variant="node"
								data-id={`resource-node-${item.id}-types`}
							/>
						) : null
					}
				/>
			)}
		/>
	);
}
