import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";
import { ResourceTreeCanvas } from "../../features/resource-tree/resource-tree-canvas";
import type { TreeItem } from "../../features/resource-tree/tree-layout";
import { cn } from "../../lib/cn";
import { GeneratedEndpointsList } from "./generated-endpoints-list";
import { LandingSection } from "./landing-section";
import {
	RELATIONS_SEED,
	endpointCount,
	endpointGroups,
} from "./relations-endpoints";

const CARD_HEAD =
	"flex items-center justify-between gap-2 border-border-subtle border-b px-6 py-3";

/** Moves `moving` under `target` (null = root), keeping sibling order. */
function moveItem(
	items: readonly TreeItem[],
	moving: TreeItem,
	target: TreeItem | null,
): TreeItem[] {
	return items.map((item) =>
		item.id === moving.id ? { ...item, parentId: target?.id ?? null } : item,
	);
}

/**
 * "Quan hệ giữa resources": the tree canvas in demo mode next to the
 * endpoints it generates. State lives in this component only; nothing is
 * sent to the API.
 */
export function RelationsDemo() {
	const toast = useToast();
	const [items, setItems] = useState<readonly TreeItem[]>(RELATIONS_SEED);
	const groups = useMemo(() => endpointGroups(items), [items]);
	const count = endpointCount(groups);

	return (
		<LandingSection
			id="relations"
			data-id="landing-relations"
			eyebrow="Quan hệ"
			title="Quan hệ giữa các resource"
			lead={
				<>
					Lồng resource vào nhau để có endpoint dạng{" "}
					<code>/users/:userId/posts</code>. Thử lồng <b>comments</b> vào{" "}
					<b>posts</b> bên dưới.
				</>
			}
		>
			<div className="grid gap-4 lg:grid-cols-8">
				<section
					data-id="landing-relations-tree"
					aria-labelledby="landing-relations-tree-title"
					className={cn(cardClassName, "min-w-0 lg:col-span-5")}
				>
					<div className={CARD_HEAD}>
						<h3
							id="landing-relations-tree-title"
							className="m-0 font-bold font-mono text-sm"
						>
							Cây resource
						</h3>
						<Button
							variant="ghost"
							size="sm"
							data-id="landing-relations-reset"
							onClick={() => setItems(RELATIONS_SEED)}
						>
							Đặt lại
						</Button>
					</div>
					<ResourceTreeCanvas
						mode="demo"
						resources={items}
						onMove={(moving, target) => {
							setItems((current) => moveItem(current, moving, target));
							toast.show({
								title: target
									? `Đã lồng ${moving.name} vào ${target.name}.`
									: `Đã đưa ${moving.name} về root.`,
							});
						}}
					/>
				</section>
				<section
					data-id="landing-relations-endpoints"
					aria-labelledby="landing-relations-endpoints-title"
					className={cn(
						cardClassName,
						"flex min-w-0 flex-col lg:col-span-3 lg:h-0 lg:min-h-full",
					)}
				>
					<div className={CARD_HEAD}>
						<h3
							id="landing-relations-endpoints-title"
							className="m-0 font-bold font-mono text-sm"
						>
							Endpoint được sinh
						</h3>
						<span aria-live="polite">
							<Badge tone="primary" data-id="landing-relations-count">
								{count} endpoint
							</Badge>
						</span>
					</div>
					<section
						aria-label="Danh sách endpoint, cuộn dọc"
						// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1).
						tabIndex={0}
						className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
					>
						<GeneratedEndpointsList groups={groups} />
					</section>
				</section>
			</div>
		</LandingSection>
	);
}
