import { IconBox, IconPlus } from "@tabler/icons-react";
import type { RefObject } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { PanelProgress } from "../../components/ui/panel-progress";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import type { ProjectAction } from "./project-actions-menu";
import { ProjectRow } from "./project-row";
import type { Project } from "./projects-api";
import { ProjectsSkeleton } from "./projects-skeleton";
import type { ProjectsState } from "./use-projects";

/**
 * Where focus goes when a row disappears: the next row's link, else the
 * previous one's, else the page heading. Call before the row is removed.
 */
export function focusAfterRow(
	projectId: string,
	heading: RefObject<HTMLElement | null>,
): HTMLElement | null {
	const row = document.querySelector(`[data-id="project-row-${projectId}"]`);
	const sibling = row?.nextElementSibling ?? row?.previousElementSibling;
	return sibling?.querySelector<HTMLElement>("a") ?? heading.current;
}

export interface ProjectsListProps {
	state: ProjectsState;
	onRetry: () => void;
	onCreate: () => void;
	onAction: (action: ProjectAction, project: Project) => void;
}

/**
 * Loading, error, empty and list states of the projects page. First load:
 * nothing for 150 ms, then the skeleton for at least 300 ms. A refetch
 * keeps the list and runs a bar along its top.
 */
export function ProjectsList({
	state,
	onRetry,
	onCreate,
	onAction,
}: ProjectsListProps) {
	const t = useT();
	const skeleton = useDelayedFlag(state.status === "loading");
	if (skeleton) return <ProjectsSkeleton />;
	if (state.status === "loading") return null;
	if (state.status === "error") {
		return (
			<div data-id="projects-error" className="grid justify-items-start gap-3">
				<Alert tone="danger" title={t("projects.list.loadFailed")}>
					{errorMessage(state.error)}
				</Alert>
				<Button
					data-id="projects-error-retry"
					loading={state.retrying}
					onClick={onRetry}
				>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	}
	return (
		<PanelProgress
			data-id="projects-panel"
			active={state.refreshing}
			aria-busy={state.refreshing || undefined}
		>
			{state.projects.length === 0 ? (
				<EmptyState
					data-id="projects-empty"
					icon={<IconBox size={32} aria-hidden="true" />}
					title={t("projects.list.emptyTitle")}
					action={
						<Button
							variant="primary"
							data-id="projects-empty-create"
							leadingIcon={<IconPlus size={20} aria-hidden="true" />}
							onClick={onCreate}
						>
							{t("projects.list.create")}
						</Button>
					}
				>
					{t("projects.list.emptyBody")}
				</EmptyState>
			) : (
				<ul data-id="projects-list" className="m-0 grid list-none gap-3 p-0">
					{state.projects.map((project) => (
						<ProjectRow
							key={project.id}
							project={project}
							onAction={onAction}
						/>
					))}
				</ul>
			)}
		</PanelProgress>
	);
}
