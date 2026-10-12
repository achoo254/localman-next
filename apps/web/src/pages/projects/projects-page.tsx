import { limitsFor } from "@localman/shared/constants";
import { IconPlus } from "@tabler/icons-react";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { IconButton } from "../../components/ui/icon-button";
import { useToast } from "../../components/ui/toast";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { ProjectMemberDialogs } from "../../features/collaborators/project-member-dialogs";
import { useLimitNotice } from "../../features/subscription/use-limit-notice";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { useAppTitle } from "../../lib/use-document-title";
import { markProjectCreated } from "../project-detail/use-first-resource-prompt";
import { DeleteProjectModal } from "./delete-project-modal";
import { OpenProjectLink } from "./open-project-link";
import type { ProjectAction } from "./project-actions-menu";
import { ProjectFormModal } from "./project-form-modal";
import { maskSecretHost } from "./project-validation";
import {
	type Project,
	type ProjectInput,
	cloneProject,
	createProject,
	isPlanLimitError,
	updateProject,
} from "./projects-api";
import { ProjectsList, focusAfterRow } from "./projects-list";
import {
	projectsState,
	useProjects,
	useSetProjects,
	withMemberCount,
} from "./use-projects";

type Dialog =
	| { kind: "none" }
	| { kind: "form"; project: Project | null }
	| { kind: "delete" | "collaborators" | "magic-link"; project: Project };

const CLOSED: Dialog = { kind: "none" };

/** `/projects`: owned and shared projects with create, edit, clone, delete. */
export function ProjectsPage() {
	const t = useT();
	useAppTitle(t("projects.title"));
	const session = useCurrentUser();
	const plan = session.status === "authenticated" ? session.user.plan : "free";
	const toast = useToast();
	const navigate = useNavigate();
	const limitNotice = useLimitNotice();
	const query = useProjects();
	const setProjects = useSetProjects();
	const [dialog, setDialog] = useState<Dialog>(CLOSED);
	const heading = useRef<HTMLHeadingElement>(null);

	const projects = query.data ?? [];
	const owned = projects.filter((project) => project.role === "owner").length;

	/** Members changed in the collaborators dialog: refresh the row's count. */
	const setMemberCount = useCallback(
		(id: string, memberCount: number) =>
			setProjects((list) => withMemberCount(list, id, memberCount)),
		[setProjects],
	);

	const replaceProject = (saved: Project) =>
		setProjects((list) => list.map((p) => (p.id === saved.id ? saved : p)));

	function hitLimit() {
		setDialog(CLOSED);
		limitNotice("projects");
	}

	function openNew() {
		if (owned >= limitsFor(plan).projects) hitLimit();
		else setDialog({ kind: "form", project: null });
	}

	async function save(editing: Project | null, input: ProjectInput) {
		const saved = editing
			? await updateProject(editing.id, input)
			: await createProject(input);
		if (editing) replaceProject(saved);
		else {
			setProjects((list) => [...list, saved]);
			// Its page offers a first resource on the next visit only.
			markProjectCreated(saved.id);
		}
		const done = editing ? "projects.toast.updated" : "projects.toast.created";
		// A new project stays in the list; the toast leads to its page.
		toast.show({
			title: t(done, { name: saved.name }),
			description: editing ? undefined : (
				<OpenProjectLink project={saved} navigate={navigate} />
			),
		});
		setDialog(CLOSED);
	}

	async function clone(source: Project) {
		try {
			const copy = await cloneProject(source.id);
			setProjects((list) => {
				const index = list.findIndex((p) => p.id === source.id);
				return [...list.slice(0, index + 1), copy, ...list.slice(index + 1)];
			});
			toast.show({ title: t("projects.toast.cloned", { name: copy.name }) });
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
						{t("projects.title")}
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
					label={t("projects.add")}
					data-id="projects-add"
					icon={<IconPlus size={20} aria-hidden="true" />}
					onClick={openNew}
				/>
			</div>
			<ProjectsList
				state={projectsState(query)}
				onRetry={() => void query.refetch()}
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
						toast.show({
							title: t("projects.toast.deleted", { name: gone.name }),
						});
					}}
				/>
			) : null}
			{dialog.kind === "collaborators" || dialog.kind === "magic-link" ? (
				<ProjectMemberDialogs
					kind={dialog.kind}
					project={dialog.project}
					onClose={() => setDialog(CLOSED)}
					onMemberCount={setMemberCount}
					onProjectChange={replaceProject}
					onLeft={(gone) => {
						setDialog(CLOSED);
						setProjects((list) => list.filter((p) => p.id !== gone.id));
					}}
					focusAfterLeave={() => focusAfterRow(dialog.project.id, heading)}
				/>
			) : null}
		</section>
	);
}
