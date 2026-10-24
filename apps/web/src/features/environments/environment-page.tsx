import type { EnvironmentDetail } from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import type { VariablesPageTab } from "../api-client/workbench/workbench-tab-types";
import { ShareDialog } from "../sharing/share-dialog";
import { isNotFound } from "../sharing/sharing-errors";
import { combinedStatus } from "./combined-status";
import { DeleteEnvironmentModal } from "./delete-environment-modal";
import { EnvironmentHeader } from "./environment-header";
import { setEnvironmentVariables } from "./environments-api";
import { useExportEnvironment } from "./use-environment-file";
import { useEnvironmentLocal } from "./use-environment-local";
import { useEnvironmentMeta } from "./use-environment-meta";
import {
	storeEnvironment,
	useActiveEnvironment,
	useEnvironment,
	useSetActiveEnvironment,
} from "./use-environments";
import { useVariableBulk } from "./use-variable-bulk";
import { useVariableEditor } from "./use-variable-editor";
import { VariableTable } from "./variable-table";

function EnvironmentEditor({
	environment,
	pageId,
}: {
	environment: EnvironmentDetail;
	pageId: string;
}) {
	const t = useT();
	const client = useQueryClient();
	const { closeTab } = useWorkbenchActions();
	const { id, workspaceId } = environment;
	const active = useActiveEnvironment(workspaceId);
	const setActive = useSetActiveEnvironment(workspaceId);
	const [sharing, setSharing] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const { meta, canManage, duplicate } = useEnvironmentMeta(
		environment,
		pageId,
	);
	const { localValues, agent, saveLocal } = useEnvironmentLocal(environment);
	const editor = useVariableEditor({
		variables: environment.variables,
		localValues,
		canEdit: environment.role === "editor",
		saveShared: async (writes) =>
			storeEnvironment(client, await setEnvironmentVariables(id, writes)),
		saveLocal,
	});
	const bulk = useVariableBulk(editor);
	const exportFile = useExportEnvironment();
	const isActive = active.data?.environmentId === id;
	const status = combinedStatus(meta.status, editor.status);
	return (
		<div
			data-id="environment-editor"
			className="grid min-h-0 content-start overflow-y-auto"
		>
			<EnvironmentHeader
				environment={environment}
				name={meta.pending.name ?? environment.name}
				color={meta.pending.color ?? environment.color}
				active={isActive}
				canDuplicate={canManage}
				canDelete={canManage && environment.role === "editor"}
				status={status}
				onRename={(name) => meta.edit({ name })}
				onColor={(color) => meta.edit({ color })}
				onRetry={() => void Promise.all([meta.flush(), editor.flush()])}
				onToggleActive={() => setActive.mutate(isActive ? null : id)}
				onShare={() => setSharing(true)}
				onDuplicate={() => void duplicate()}
				onExport={() => void exportFile(id, environment.name)}
				onDelete={() => setDeleting(true)}
				bulkItems={bulk.items}
			/>
			<div className="grid gap-4 px-4 py-4">
				{environment.role === "editor" ? null : (
					<Alert
						tone="info"
						data-id="environment-viewer-note"
						title={t("environments.page.viewerTitle")}
					>
						{t("environments.page.viewerNote")}
					</Alert>
				)}
				<VariableTable
					editor={editor}
					caption={t("environments.table.caption", { name: environment.name })}
					agentUse={agent.scope}
				/>
			</div>
			{bulk.dialogs}
			{agent.dialog}
			<ShareDialog
				elementType="environment"
				elementId={id}
				elementName={environment.name}
				open={sharing}
				onOpenChange={setSharing}
			/>
			<DeleteEnvironmentModal
				environmentId={id}
				workspaceId={workspaceId}
				name={environment.name}
				open={deleting}
				onOpenChange={setDeleting}
				onDeleted={() => closeTab(pageId)}
			/>
		</div>
	);
}

/** An environment open as a tab: its variables with your local values. */
export function EnvironmentPage({ page }: { page: VariablesPageTab }) {
	const t = useT();
	const query = useEnvironment(page.targetId);
	const skeleton = useDelayedFlag(query.isPending);
	if (skeleton) {
		return (
			<SkeletonRegion
				label={t("environments.page.loading")}
				className="grid gap-3 p-4"
			>
				<Skeleton className="h-9 w-64" />
				<Skeleton variant="text" lines={4} />
			</SkeletonRegion>
		);
	}
	if (query.isPending) return null;
	if (!query.data) {
		return (
			<div className="grid gap-3 p-4" data-id="environment-load-error">
				<Alert tone="danger">
					{isNotFound(query.error)
						? t("environments.page.gone")
						: t("environments.page.loadFailed")}
				</Alert>
				{isNotFound(query.error) ? null : (
					<Button
						className="justify-self-start"
						onClick={() => void query.refetch()}
					>
						{t("common.cta.retry")}
					</Button>
				)}
			</div>
		);
	}
	return (
		<EnvironmentEditor
			key={query.data.id}
			environment={query.data}
			pageId={page.id}
		/>
	);
}
