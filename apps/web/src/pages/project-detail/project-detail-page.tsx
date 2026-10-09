import { IconBox } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { useToast } from "../../components/ui/toast";
import { useCurrentUser } from "../../features/auth/use-current-user";
import {
	type MemberDialogKind,
	ProjectMemberDialogs,
} from "../../features/collaborators/project-member-dialogs";
import type { Resource } from "../../features/resources/resource-model";
import { useResources } from "../../features/resources/use-resources";
import { useSubscriptionDialogs } from "../../features/subscription/use-subscription-dialogs";
import { errorMessage } from "../../lib/api-client";
import { useAppTitle } from "../../lib/use-document-title";
import type { Project } from "../projects/projects-api";
import { RotateSecretModal } from "../projects/rotate-secret-modal";
import { ApiEndpointCard } from "./api-endpoint-card";
import {
	NO_DIALOG,
	ProjectDetailDialogs,
	type ProjectDialog,
} from "./project-detail-dialogs";
import { ProjectDetailHeader } from "./project-detail-header";
import { ResourcesCard, type ResourcesState } from "./resources-card";
import { useFirstResourcePrompt } from "./use-first-resource-prompt";
import { useProject } from "./use-project";
import { useProjectActions } from "./use-project-actions";

/** `/projects/:projectId`: API endpoint card, resource tree and modals. */
export function ProjectDetailPage() {
	const { projectId = "" } = useParams();
	const project = useProject(projectId);
	useAppTitle(project.data?.name ?? "Project");
	if (project.isPending) {
		return (
			<output
				data-id="project-detail-loading"
				className="block py-8 font-mono text-muted text-sm"
			>
				Đang tải project…
			</output>
		);
	}
	if (project.isError) {
		return (
			<div
				data-id="project-detail-error"
				className="grid justify-items-start gap-3"
			>
				<Alert tone="danger" title="Không tải được project">
					{errorMessage(project.error)}
				</Alert>
				<Button onClick={() => void project.refetch()}>Thử lại</Button>
			</div>
		);
	}
	if (!project.data) {
		return (
			<EmptyState
				data-id="project-missing"
				headingLevel={1}
				icon={<IconBox size={32} aria-hidden="true" />}
				title="Không tìm thấy project"
				action={
					<Link
						to="/projects"
						className={buttonClassName({ variant: "primary" })}
						data-id="project-missing-back"
					>
						Về danh sách projects
					</Link>
				}
			>
				Project có thể đã bị xoá hoặc bạn không có quyền truy cập.
			</EmptyState>
		);
	}
	return <ProjectDetail project={project.data} />;
}

function ProjectDetail({ project }: { project: Project }) {
	const session = useCurrentUser();
	const plan = session.status === "authenticated" ? session.user.plan : "free";
	const subscription = useSubscriptionDialogs(plan);
	const toast = useToast();
	const query = useResources(project.id);
	const resources = query.data ?? [];
	const [dialog, setDialog] = useState<ProjectDialog>(NO_DIALOG);
	const [rotating, setRotating] = useState(false);
	const [members, setMembers] = useState<MemberDialogKind | null>(null);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	// Only on a real change: setQueryData re-renders even for equal data.
	const setMemberCount = useCallback(
		(id: string, memberCount: number) => {
			const old = queryClient.getQueryData<Project | null>(["project", id]);
			if (!old || old.memberCount === memberCount) return;
			queryClient.setQueryData(["project", id], { ...old, memberCount });
		},
		[queryClient],
	);
	const actions = useProjectActions(project.id, resources, (confirm) =>
		setDialog({ kind: "confirm", confirm }),
	);
	const openNew = () => setDialog({ kind: "form", resource: null });

	useFirstResourcePrompt(
		query.isSuccess && query.data.length === 0,
		members !== null || rotating,
		() =>
			setDialog((current) =>
				current.kind === "none" ? { kind: "form", resource: null } : current,
			),
	);

	const state: ResourcesState = query.isPending
		? { status: "loading" }
		: query.isError
			? { status: "error", error: query.error }
			: { status: "ready", resources };

	return (
		<section
			data-id="project-detail"
			className="grid grid-cols-[minmax(0,1fr)] gap-6"
		>
			<ProjectDetailHeader project={project} onOpen={setMembers} />
			<ApiEndpointCard
				project={project}
				resources={resources}
				busy={actions.busy}
				onNewResource={openNew}
				onGenerateAll={() => void actions.generateAll()}
				onResetAll={() => void actions.resetAll()}
				onRotateSecret={
					project.role === "owner" ? () => setRotating(true) : undefined
				}
			/>
			<ResourcesCard
				state={state}
				mockBaseUrl={project.mockBaseUrl}
				onRetry={() => void query.refetch()}
				onNewResource={openNew}
				onGenerate={(resource, count) => void actions.generate(resource, count)}
				onAction={(action, resource: Resource) =>
					setDialog({ kind: action === "edit" ? "form" : action, resource })
				}
				onMove={(resource, target) => void actions.move(resource, target)}
			/>
			<ProjectDetailDialogs
				projectId={project.id}
				dialog={dialog}
				resources={resources}
				onClose={() => setDialog(NO_DIALOG)}
				onPlanLimit={() => {
					setDialog(NO_DIALOG);
					// The owner's plan applies; a collaborator cannot upgrade it.
					if (project.role === "owner") subscription.openPlans("resources");
					else {
						toast.show({
							tone: "info",
							title:
								"Project đã đạt giới hạn resource theo gói của chủ project.",
						});
					}
				}}
			/>
			{rotating ? (
				// The new project lands in the query cache, so this page re-renders.
				<RotateSecretModal
					project={project}
					onOpenChange={(open) => !open && setRotating(false)}
				/>
			) : null}
			<ProjectMemberDialogs
				kind={members}
				project={project}
				plan={plan}
				onClose={() => setMembers(null)}
				onPlans={() => subscription.openPlans("members")}
				onMemberCount={setMemberCount}
				// The rotated project is already in the query cache.
				onProjectChange={() => {}}
				onLeft={() => navigate("/projects", { replace: true })}
				focusAfterLeave={() => null}
			/>
			{subscription.element}
		</section>
	);
}
