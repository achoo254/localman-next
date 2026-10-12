import type { EnvironmentSummary } from "@localman/shared/api-client";
import { IconPlus, IconWorld } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import type { Workspace } from "../workspaces/workspaces-api";
import { DeleteEnvironmentModal } from "./delete-environment-modal";
import { EnvironmentListRow } from "./environment-list-row";
import { createEnvironment, duplicateEnvironment } from "./environments-api";
import {
	storeEnvironment,
	useActiveEnvironment,
	useEnvironmentList,
	useSetActiveEnvironment,
} from "./use-environments";
import {
	useOpenVariablesPage,
	variablesPageId,
} from "./use-open-variables-page";

export interface EnvironmentsSidebarProps {
	workspace: Workspace;
	/** Tab id of the page in view, to mark its row. */
	openedId: string | null;
	/** Closes a deleted environment's tab. */
	onClosePage: (pageId: string) => void;
}

/** Globals, then the workspace's environments with the active one marked. */
export function EnvironmentsSidebar(props: EnvironmentsSidebarProps) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const titleId = useId();
	const workspaceId = props.workspace.id;
	const canAdd = props.workspace.role !== "viewer";
	const list = useEnvironmentList(workspaceId);
	const active = useActiveEnvironment(workspaceId);
	const setActive = useSetActiveEnvironment(workspaceId);
	const { openEnvironment, openGlobals } = useOpenVariablesPage();
	const [deleting, setDeleting] = useState<EnvironmentSummary | null>(null);
	const skeleton = useDelayedFlag(list.isPending);
	const fail = (title: string) => (error: unknown) =>
		toast.show({ tone: "error", title, description: errorMessage(error) });
	const create = useMutation({
		mutationFn: () =>
			createEnvironment(workspaceId, {
				name: t("environments.sidebar.newName"),
			}),
		onSuccess: (detail) => {
			storeEnvironment(client, detail);
			openEnvironment(detail.id, detail.name);
		},
		onError: fail(t("environments.errors.createFailed")),
	});
	const duplicate = useMutation({
		mutationFn: duplicateEnvironment,
		onSuccess: (detail) => {
			storeEnvironment(client, detail);
			openEnvironment(detail.id, detail.name);
		},
		onError: fail(t("environments.errors.duplicateFailed")),
	});
	const activeId = active.data?.environmentId ?? null;
	return (
		<section aria-labelledby={titleId} data-id="environments-sidebar">
			<header className="flex items-center gap-1 border-border-subtle border-b py-2 pr-2 pl-3">
				<h2
					id={titleId}
					className="m-0 min-w-0 flex-1 truncate font-bold font-mono text-sm"
				>
					{t("environments.sidebar.title")}
				</h2>
				<IconButton
					size="sm"
					data-id="environments-add"
					label={t("environments.sidebar.add")}
					title={
						canAdd
							? t("environments.sidebar.add")
							: t("environments.sidebar.readOnly")
					}
					disabled={!canAdd}
					loading={create.isPending}
					icon={<IconPlus size={18} aria-hidden="true" />}
					onClick={() => create.mutate()}
				/>
			</header>
			<div className="grid gap-1 p-2">
				<button
					type="button"
					data-id="environments-globals"
					aria-current={
						props.openedId === variablesPageId("globals", workspaceId)
							? "page"
							: undefined
					}
					className="flex min-h-9 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-3 text-left text-sm hover:bg-fg/4"
					onClick={() => openGlobals(workspaceId)}
				>
					<IconWorld size={16} aria-hidden="true" className="text-icon-muted" />
					{t("environments.globals.title")}
				</button>
				{skeleton ? (
					<SkeletonRegion
						label={t("environments.sidebar.loading")}
						className="grid gap-2 px-3"
					>
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-5 w-32" />
					</SkeletonRegion>
				) : null}
				{list.isError ? (
					<Alert tone="danger" title={t("environments.sidebar.loadFailed")}>
						<Button size="sm" onClick={() => void list.refetch()}>
							{t("common.cta.retry")}
						</Button>
					</Alert>
				) : null}
				{list.data?.length === 0 ? (
					<p
						data-id="environments-empty"
						className="m-0 px-3 py-2 text-muted text-sm"
					>
						{t("environments.sidebar.empty")}
					</p>
				) : null}
				<ul className="m-0 grid list-none gap-0.5 p-0">
					{(list.data ?? []).map((environment) => (
						<EnvironmentListRow
							key={environment.id}
							environment={environment}
							active={environment.id === activeId}
							opened={
								props.openedId ===
								variablesPageId("environment", environment.id)
							}
							canDuplicate={canAdd}
							canDelete={canAdd && environment.role === "editor"}
							onOpen={() => openEnvironment(environment.id, environment.name)}
							onToggleActive={() =>
								setActive.mutate(
									environment.id === activeId ? null : environment.id,
								)
							}
							onDuplicate={() => duplicate.mutate(environment.id)}
							onDelete={() => setDeleting(environment)}
						/>
					))}
				</ul>
			</div>
			{deleting ? (
				<DeleteEnvironmentModal
					environmentId={deleting.id}
					workspaceId={workspaceId}
					name={deleting.name}
					open
					onOpenChange={(open) => {
						if (!open) setDeleting(null);
					}}
					onDeleted={() =>
						props.onClosePage(variablesPageId("environment", deleting.id))
					}
				/>
			) : null}
		</section>
	);
}
