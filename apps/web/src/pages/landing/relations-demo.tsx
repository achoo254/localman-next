import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";
import { ResourceTreeCanvas } from "../../features/resource-tree/resource-tree-canvas";
import type { TreeItem } from "../../features/resource-tree/tree-layout";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
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
 * "Relations between resources": the tree canvas in demo mode next to the
 * endpoints it generates. State lives in this component only; nothing is
 * sent to the API.
 */
export function RelationsDemo() {
	const toast = useToast();
	const t = useT();
	const [items, setItems] = useState<readonly TreeItem[]>(RELATIONS_SEED);
	const groups = useMemo(() => endpointGroups(items), [items]);
	const count = endpointCount(groups);

	return (
		<LandingSection
			id="relations"
			data-id="landing-relations"
			eyebrow={t("landing.relations.eyebrow")}
			title={t("landing.relations.title")}
			lead={renderRich(t("landing.relations.lead"))}
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
							{t("landing.relations.tree")}
						</h3>
						<Button
							variant="ghost"
							size="sm"
							data-id="landing-relations-reset"
							onClick={() => setItems(RELATIONS_SEED)}
						>
							{t("common.cta.reset")}
						</Button>
					</div>
					<ResourceTreeCanvas
						mode="demo"
						resources={items}
						onMove={(moving, target) => {
							setItems((current) => moveItem(current, moving, target));
							toast.show({
								title: target
									? t("landing.relations.nested", {
											child: moving.name,
											parent: target.name,
										})
									: t("landing.relations.movedToRoot", { child: moving.name }),
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
							{t("landing.relations.endpoints")}
						</h3>
						<span aria-live="polite">
							<Badge tone="primary" data-id="landing-relations-count">
								{t("landing.relations.endpointCount", { count })}
							</Badge>
						</span>
					</div>
					<section
						aria-label={t("landing.relations.listLabel")}
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
