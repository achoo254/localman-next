import { IconDatabase, IconFileImport, IconPlus } from "@tabler/icons-react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { PanelProgress } from "../../components/ui/panel-progress";
import { SkeletonRegion } from "../../components/ui/skeleton";
import { useFeatures } from "../../config/features";
import { useOpenInApiClient } from "../../features/api-client/open-in/use-open-in-api-client";
import type { NodeAction } from "../../features/resource-tree/node-actions";
import { ResourceTreeCanvas } from "../../features/resource-tree/resource-tree-canvas";
import { TreeSkeleton } from "../../features/resource-tree/tree-skeleton";
import { resourceErrorMessage } from "../../features/resources/resource-errors";
import type { Resource } from "../../features/resources/resource-model";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";

export type ResourcesState =
	| { status: "loading" }
	/** `retrying`: "Try again" was pressed and the request runs. */
	| { status: "error"; error: unknown; retrying: boolean }
	/** `refreshing`: a refetch runs while the tree stays on screen. */
	| { status: "ready"; resources: Resource[]; refreshing: boolean };

export interface ResourcesCardProps {
	/** Project of the resources, for "Open in API Client". */
	projectId: string;
	state: ResourcesState;
	mockBaseUrl: string;
	onRetry: () => void;
	onNewResource: () => void;
	onImport: () => void;
	onGenerate: (resource: Resource, count: number) => void;
	onAction: (action: NodeAction, resource: Resource) => void;
	onMove: (resource: Resource, target: Resource | null) => void;
}

/**
 * "Resources" card: loading, error and empty states, or the tree canvas.
 * First load shows a tree-shaped skeleton after 150 ms; a refetch keeps
 * the tree and runs a bar under the card header.
 */
export function ResourcesCard({
	projectId,
	state,
	mockBaseUrl,
	onRetry,
	onNewResource,
	onImport,
	...canvas
}: ResourcesCardProps) {
	const t = useT();
	const { mockPowerUps, apiClient } = useFeatures();
	const openInClient = useOpenInApiClient();
	const skeleton = useDelayedFlag(state.status === "loading");
	let body = null;
	if (skeleton) {
		body = (
			<SkeletonRegion
				data-id="project-detail-tree-loading"
				label={t("projectDetail.resources.loading")}
			>
				<TreeSkeleton />
			</SkeletonRegion>
		);
	} else if (state.status === "error") {
		body = (
			<div className="grid justify-items-start gap-3 p-6">
				<Alert tone="danger" title={t("projectDetail.resources.loadFailed")}>
					{resourceErrorMessage(state.error, t)}
				</Alert>
				<Button
					data-id="project-detail-tree-retry"
					loading={state.retrying}
					onClick={onRetry}
				>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	} else if (state.status === "ready" && state.resources.length === 0) {
		body = (
			<div
				data-id="project-detail-tree-empty"
				className="grid justify-items-center gap-3 px-4 py-8 text-center text-muted text-sm"
			>
				<IconDatabase
					size={32}
					aria-hidden="true"
					className="text-icon-muted"
				/>
				<p className="m-0">{t("projectDetail.resources.empty")}</p>
				<div className="flex flex-wrap justify-center gap-2">
					<Button
						variant="primary"
						data-id="project-detail-tree-empty-create"
						leadingIcon={<IconPlus size={20} aria-hidden="true" />}
						onClick={onNewResource}
					>
						{t("projectDetail.addResource")}
					</Button>
					{mockPowerUps ? (
						<Button
							data-id="project-detail-tree-empty-import"
							leadingIcon={<IconFileImport size={20} aria-hidden="true" />}
							onClick={onImport}
						>
							{t("resourceImport.entry")}
						</Button>
					) : null}
				</div>
			</div>
		);
	} else if (state.status === "ready") {
		body = (
			<ResourceTreeCanvas
				resources={state.resources}
				mockBaseUrl={mockBaseUrl}
				{...canvas}
				onOpenInClient={
					apiClient
						? (resource) => openInClient({ projectId, resourceId: resource.id })
						: undefined
				}
			/>
		);
	}
	const ready = state.status === "ready" && !skeleton ? state : null;
	const count = ready ? ready.resources.length : null;
	return (
		<section
			data-id="project-detail-tree"
			aria-labelledby="project-detail-tree-title"
			className={cn(cardClassName, "min-w-0 overflow-hidden")}
		>
			<div className="flex flex-wrap items-baseline justify-between gap-2 border-border-subtle border-b px-6 py-4">
				<h2
					id="project-detail-tree-title"
					className="m-0 font-bold font-mono text-[0.9375rem]"
				>
					Resources
				</h2>
				{count === null ? null : (
					<span className="font-mono text-[0.8125rem] text-muted">
						{t("projectDetail.resources.count", { count })}
					</span>
				)}
			</div>
			{ready ? (
				<PanelProgress
					data-id="project-detail-tree-panel"
					active={ready.refreshing}
					aria-busy={ready.refreshing || undefined}
				>
					{body}
				</PanelProgress>
			) : (
				body
			)}
		</section>
	);
}
