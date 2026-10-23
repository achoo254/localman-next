import { workspaceRoleAllows } from "@localman/shared/access";
import { IconRefresh } from "@tabler/icons-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useToast } from "../../components/ui/toast";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import type { Project } from "../../pages/projects/projects-api";
import { useOpenInApiClient } from "../api-client/open-in/use-open-in-api-client";
import { fetchCollection } from "../collections/collections-api";
import { useCurrentWorkspace } from "../workspaces/current-workspace";
import { syncNamesOf } from "./sync-names";
import {
	useCreateSyncedCollection,
	useLiveMockSyncEnabled,
	useProjectSyncedCollections,
} from "./use-live-mock-sync";

/**
 * On a mock project's page: "Live Mock Sync" and "Open synced collection"
 * once a collection follows it, else "Create synced collection" in the
 * current workspace (for those who add elements there).
 */
export function ProjectSyncActions({ project }: { project: Project }) {
	const t = useT();
	const toast = useToast();
	const { apiClient } = useFeatures();
	const enabled = useLiveMockSyncEnabled() && apiClient;
	const synced = useProjectSyncedCollections(project.id);
	const { current } = useCurrentWorkspace(enabled);
	const create = useCreateSyncedCollection();
	const openInClient = useOpenInApiClient();
	if (!enabled || !synced.data) return null;
	const open = (collection: { id: string; name: string }) =>
		openInClient({ projectId: project.id, collection });
	const first = synced.data[0];
	if (first) {
		return (
			<>
				<Badge
					tone="primary"
					data-id="project-detail-sync-badge"
					title={first.name}
				>
					<IconRefresh size={12} aria-hidden="true" />
					{t("liveMockSync.badge.project")}
				</Badge>
				<Button
					size="sm"
					data-id="project-detail-open-sync"
					leadingIcon={<IconRefresh size={16} aria-hidden="true" />}
					onClick={() => open({ id: first.collectionId, name: first.name })}
				>
					{t("liveMockSync.project.open")}
				</Button>
			</>
		);
	}
	if (!current || !workspaceRoleAllows(current.role, "addElements"))
		return null;
	const makeIt = () =>
		create.mutate(
			{ projectId: project.id, workspaceId: current.id, names: syncNamesOf(t) },
			{
				onSuccess: async ({ collectionId }) => {
					const detail = await fetchCollection(collectionId);
					toast.show({
						tone: "success",
						title: t("liveMockSync.project.created", { name: detail.name }),
					});
					open({ id: detail.id, name: detail.name });
				},
				onError: (error) =>
					toast.show({ tone: "error", title: errorMessage(error) }),
			},
		);
	return (
		<Button
			size="sm"
			data-id="project-detail-create-sync"
			loading={create.isPending}
			leadingIcon={<IconRefresh size={16} aria-hidden="true" />}
			onClick={makeIt}
		>
			{t("liveMockSync.project.create")}
		</Button>
	);
}
