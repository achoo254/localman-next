import { IconBox, IconPlus } from "@tabler/icons-react";
import type { RefObject } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { errorMessage } from "../../lib/api-client";
import type { ProjectAction } from "./project-actions-menu";
import { ProjectRow } from "./project-row";
import type { Project } from "./projects-api";

export type ProjectsState =
	| { status: "loading" }
	| { status: "ready"; projects: Project[] }
	| { status: "error"; error: unknown };

/**
 * `state` with the member count of one project changed; the same object
 * when nothing changes, so React skips the render.
 */
export function withMemberCount(
	state: ProjectsState,
	id: string,
	memberCount: number,
): ProjectsState {
	if (state.status !== "ready") return state;
	const project = state.projects.find((p) => p.id === id);
	if (!project || project.memberCount === memberCount) return state;
	const projects = state.projects.map((p) =>
		p.id === id ? { ...p, memberCount } : p,
	);
	return { status: "ready", projects };
}

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

/** Loading, error, empty and list states of the projects page. */
export function ProjectsList({
	state,
	onRetry,
	onCreate,
	onAction,
}: ProjectsListProps) {
	if (state.status === "loading") {
		return (
			<output
				data-id="projects-loading"
				className="block py-8 font-mono text-muted text-sm"
			>
				Đang tải danh sách project…
			</output>
		);
	}
	if (state.status === "error") {
		return (
			<div data-id="projects-error" className="grid justify-items-start gap-3">
				<Alert tone="danger" title="Không tải được danh sách project">
					{errorMessage(state.error)}
				</Alert>
				<Button data-id="projects-error-retry" onClick={onRetry}>
					Thử lại
				</Button>
			</div>
		);
	}
	if (state.projects.length === 0) {
		return (
			<EmptyState
				data-id="projects-empty"
				icon={<IconBox size={32} aria-hidden="true" />}
				title="Chưa có project nào"
				action={
					<Button
						variant="primary"
						data-id="projects-empty-create"
						leadingIcon={<IconPlus size={20} aria-hidden="true" />}
						onClick={onCreate}
					>
						Tạo project
					</Button>
				}
			>
				Project chứa các resource và endpoint mock của bạn. Tạo project đầu tiên
				để bắt đầu.
			</EmptyState>
		);
	}
	return (
		<ul data-id="projects-list" className="m-0 grid list-none gap-3 p-0">
			{state.projects.map((project) => (
				<ProjectRow key={project.id} project={project} onAction={onAction} />
			))}
		</ul>
	);
}
