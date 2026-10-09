import { limitsFor } from "@localman/shared/constants";
import { IconPlus } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "../../components/ui/icon-button";
import { useToast } from "../../components/ui/toast";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { ProjectMemberDialogs } from "../../features/collaborators/project-member-dialogs";
import { useSubscriptionDialogs } from "../../features/subscription/use-subscription-dialogs";
import { errorMessage } from "../../lib/api-client";
import { useAppTitle } from "../../lib/use-document-title";
import { DeleteProjectModal } from "./delete-project-modal";
import type { ProjectAction } from "./project-actions-menu";
import { ProjectFormModal } from "./project-form-modal";
import { maskSecretHost } from "./project-validation";
import {
	type Project,
	type ProjectInput,
	cloneProject,
	createProject,
	fetchProjects,
	isPlanLimitError,
	updateProject,
} from "./projects-api";
import {
	ProjectsList,
	type ProjectsState,
	focusAfterRow,
	withMemberCount,
} from "./projects-list";

type Dialog =
	| { kind: "none" }
	| { kind: "form"; project: Project | null }
	| { kind: "delete" | "collaborators" | "magic-link"; project: Project };

const CLOSED: Dialog = { kind: "none" };

/** `/projects`: owned and shared projects with create, edit, clone, delete. */
export function ProjectsPage() {
	useAppTitle("Projects");
	const session = useCurrentUser();
	const plan = session.status === "authenticated" ? session.user.plan : "free";
	const toast = useToast();
	const subscription = useSubscriptionDialogs(plan);
	const [state, setState] = useState<ProjectsState>({ status: "loading" });
	const [dialog, setDialog] = useState<Dialog>(CLOSED);
	const heading = useRef<HTMLHeadingElement>(null);

	const load = useCallback(async () => {
		setState({ status: "loading" });
		try {
			setState({ status: "ready", projects: await fetchProjects() });
		} catch (error) {
			setState({ status: "error", error });
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const projects = state.status === "ready" ? state.projects : [];
	const owned = projects.filter((project) => project.role === "owner").length;

	function setProjects(update: (list: Project[]) => Project[]) {
		setState((current) =>
			current.status === "ready"
				? { status: "ready", projects: update(current.projects) }
				: current,
		);
	}

	/** Members changed in the collaborators dialog: refresh the row's count. */
	const setMemberCount = useCallback((id: string, memberCount: number) => {
		setState((current) => withMemberCount(current, id, memberCount));
	}, []);

	const replaceProject = (saved: Project) =>
		setProjects((list) => list.map((p) => (p.id === saved.id ? saved : p)));

	function hitLimit() {
		setDialog(CLOSED);
		subscription.openPlans("projects");
	}

	function openNew() {
		if (owned >= limitsFor(plan).projects) hitLimit();
		else setDialog({ kind: "form", project: null });
	}

	async function save(editing: Project | null, input: ProjectInput) {
		if (editing) {
			const saved = await updateProject(editing.id, input);
			replaceProject(saved);
			toast.show({ title: `Đã cập nhật project ${saved.name}.` });
		} else {
			const created = await createProject(input);
			setProjects((list) => [...list, created]);
			toast.show({ title: `Đã tạo project ${created.name}.` });
		}
		setDialog(CLOSED);
	}

	async function clone(source: Project) {
		try {
			const copy = await cloneProject(source.id);
			setProjects((list) => {
				const index = list.findIndex((p) => p.id === source.id);
				return [...list.slice(0, index + 1), copy, ...list.slice(index + 1)];
			});
			toast.show({ title: `Đã nhân bản thành ${copy.name}.` });
		} catch (error) {
			if (isPlanLimitError(error)) hitLimit();
			else toast.show({ tone: "error", title: errorMessage(error) });
		}
	}

	function act(action: ProjectAction, project: Project) {
		if (action === "clone") void clone(project);
		else if (action === "edit") setDialog({ kind: "form", project });
		else setDialog({ kind: action, project });
	}

	const sample = projects[0]?.mockBaseUrl;

	return (
		<section data-id="projects" className="grid gap-5">
			<div className="flex min-h-11 items-center gap-3">
				<nav aria-label="Breadcrumb" className="flex items-center gap-2">
					<h1
						ref={heading}
						tabIndex={-1}
						aria-current="page"
						className="m-0 font-bold font-mono text-xl tracking-[-0.01em]"
					>
						Projects
					</h1>
					<span
						aria-hidden="true"
						className="font-mono text-icon-muted text-xl"
					>
						/
					</span>
				</nav>
				<IconButton
					variant="primary"
					label="Tạo project mới"
					data-id="projects-add"
					icon={<IconPlus size={20} aria-hidden="true" />}
					onClick={openNew}
				/>
			</div>
			<ProjectsList
				state={state}
				onRetry={() => void load()}
				onCreate={openNew}
				onAction={act}
			/>
			{dialog.kind === "form" ? (
				<ProjectFormModal
					project={dialog.project}
					sampleBaseUrl={sample ? maskSecretHost(sample) : null}
					onOpenChange={(open) => !open && setDialog(CLOSED)}
					onSave={(input) => save(dialog.project, input)}
					onPlanLimit={hitLimit}
				/>
			) : null}
			{dialog.kind === "delete" ? (
				<DeleteProjectModal
					project={dialog.project}
					onOpenChange={(open) => !open && setDialog(CLOSED)}
					onDeleted={(gone) => {
						setProjects((list) => list.filter((p) => p.id !== gone.id));
						toast.show({ title: `Đã xoá project ${gone.name}.` });
					}}
				/>
			) : null}
			{dialog.kind === "collaborators" || dialog.kind === "magic-link" ? (
				<ProjectMemberDialogs
					kind={dialog.kind}
					project={dialog.project}
					plan={plan}
					onClose={() => setDialog(CLOSED)}
					onPlans={() => subscription.openPlans("members")}
					onMemberCount={setMemberCount}
					onProjectChange={replaceProject}
					onLeft={(gone) => {
						setDialog(CLOSED);
						setProjects((list) => list.filter((p) => p.id !== gone.id));
					}}
					focusAfterLeave={() => focusAfterRow(dialog.project.id, heading)}
				/>
			) : null}
			{subscription.element}
		</section>
	);
}
