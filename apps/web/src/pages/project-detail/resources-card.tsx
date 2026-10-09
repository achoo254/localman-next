import { IconDatabase, IconFileImport, IconPlus } from "@tabler/icons-react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useFeatures } from "../../config/features";
import type { NodeAction } from "../../features/resource-tree/node-actions";
import { ResourceTreeCanvas } from "../../features/resource-tree/resource-tree-canvas";
import { resourceErrorMessage } from "../../features/resources/resource-errors";
import type { Resource } from "../../features/resources/resource-model";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

export type ResourcesState =
	| { status: "loading" }
	| { status: "error"; error: unknown }
	| { status: "ready"; resources: Resource[] };

export interface ResourcesCardProps {
	state: ResourcesState;
	mockBaseUrl: string;
	onRetry: () => void;
	onNewResource: () => void;
	onImport: () => void;
	onGenerate: (resource: Resource, count: number) => void;
	onAction: (action: NodeAction, resource: Resource) => void;
	onMove: (resource: Resource, target: Resource | null) => void;
}

/** "Resources" card: loading, error and empty states, or the tree canvas. */
export function ResourcesCard({
	state,
	mockBaseUrl,
	onRetry,
	onNewResource,
	onImport,
	...canvas
}: ResourcesCardProps) {
	const t = useT();
	const { mockPowerUps } = useFeatures();
	let body = (
		<output className="block px-6 py-8 font-mono text-muted text-sm">
			{t("projectDetail.resources.loading")}
		</output>
	);
	if (state.status === "error") {
		body = (
			<div className="grid justify-items-start gap-3 p-6">
				<Alert tone="danger" title={t("projectDetail.resources.loadFailed")}>
					{resourceErrorMessage(state.error, t)}
				</Alert>
				<Button data-id="project-detail-tree-retry" onClick={onRetry}>
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
			/>
		);
	}
	const count = state.status === "ready" ? state.resources.length : null;
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
			{body}
		</section>
	);
}
