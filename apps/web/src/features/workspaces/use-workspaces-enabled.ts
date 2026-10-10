import { useFeatures } from "../../config/features";

/**
 * Workspaces, sharing and access requests belong to the API client, so
 * they show only when both the `workspaces` and `apiClient` flags are on.
 */
export function useWorkspacesEnabled(): boolean {
	const { workspaces, apiClient } = useFeatures();
	return workspaces && apiClient;
}
