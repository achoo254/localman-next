import { useMemo } from "react";
import { useToast } from "../../components/ui/toast";
import type { Resource } from "../resources/resource-model";
import { AddToRootRail } from "./add-to-root-rail";
import type { NodeAction } from "./node-actions";
import { ResourceNode } from "./resource-node";
import { TREE_GEOMETRY, layoutTree } from "./tree-layout";
import { useTreeConnect } from "./use-tree-connect";

export interface ResourceTreeCanvasProps {
	resources: readonly Resource[];
	/** Project mock base URL, prefix included. */
	mockBaseUrl: string;
	/** Owner of the project; collaborators get a read-only canvas. */
	canEdit: boolean;
	onGenerate: (resource: Resource, count: number) => void;
	onAction: (action: NodeAction, resource: Resource) => void;
	onMove: (resource: Resource, target: Resource | null) => void;
}

const READ_ONLY_REASON = "Chỉ chủ project được sinh dữ liệu.";

export function mockUrlOf(mockBaseUrl: string, name: string): string {
	return `${mockBaseUrl.replace(/\/+$/, "")}/${encodeURIComponent(name)}`;
}

/**
 * Resource tree: SVG elbow links under absolutely placed node cards, the
 * root rail on the left, and the hint line that explains nesting. Wide
 * trees scroll inside the card, never the page.
 */
export function ResourceTreeCanvas({
	resources,
	mockBaseUrl,
	canEdit,
	onGenerate,
	onAction,
	onMove,
}: ResourceTreeCanvasProps) {
	const toast = useToast();
	const g = TREE_GEOMETRY;
	const layout = useMemo(() => layoutTree(resources), [resources]);
	const byId = useMemo(
		() => new Map(resources.map((resource) => [resource.id, resource])),
		[resources],
	);
	const connect = useTreeConnect(resources, {
		onMove,
		onRefuse: (title, tone) => toast.show({ title, tone }),
	});
	const selected = connect.selected;

	function blockedReason(resource: Resource): string | null {
		if (!canEdit) return READ_ONLY_REASON;
		const parent = resource.parentId ? byId.get(resource.parentId) : undefined;
		return parent && parent.count === 0
			? `Sinh dữ liệu cho ${parent.name} trước.`
			: null;
	}

	function blocked(resource: Resource) {
		const parent = resource.parentId ? byId.get(resource.parentId) : undefined;
		toast.show({
			tone: "error",
			title:
				canEdit && parent
					? `Cần sinh dữ liệu cho ${parent.name} trước khi sinh cho ${resource.name}.`
					: READ_ONLY_REASON,
		});
	}

	return (
		<div
			data-id="resource-tree"
			className="grid min-w-0 grid-cols-[minmax(0,1fr)]"
		>
			{canEdit ? (
				<p
					aria-live="polite"
					data-id="resource-tree-hint"
					className="m-0 px-6 pt-3 text-[0.8125rem] text-muted leading-[1.55]"
				>
					{selected ? (
						<>
							Đang chọn{" "}
							<b className="font-mono text-primary">{selected.name}</b>. Bấm
							chấm tròn bên phải resource đích để lồng vào, hoặc bấm thanh “Thêm
							vào root”. Nhấn Esc để huỷ.
						</>
					) : (
						"Bấm chấm tròn bên trái một resource để chọn, sau đó bấm chấm tròn bên phải của resource khác để lồng vào."
					)}
				</p>
			) : null}
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
					{canEdit ? (
						<AddToRootRail
							width={g.railWidth}
							height={layout.height}
							active={connect.rootActive}
							onClick={() => connect.connect(null)}
						/>
					) : null}
					{layout.nodes.map(({ item, x, y }) => (
						<ResourceNode
							key={item.id}
							resource={item}
							x={x}
							y={y}
							geometry={g}
							href={mockUrlOf(mockBaseUrl, item.name)}
							canEdit={canEdit}
							selected={selected?.id === item.id}
							selectionName={selected?.name ?? null}
							targetState={connect.targetState(item.id)}
							blockedReason={blockedReason(item)}
							onSelect={() => connect.toggle(item.id)}
							onNest={() => connect.connect(item.id)}
							onGenerate={(count) => onGenerate(item, count)}
							onBlocked={() => blocked(item)}
							onAction={(action) => onAction(action, item)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
