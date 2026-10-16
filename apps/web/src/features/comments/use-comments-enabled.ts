import { useFeatures } from "../../config/features";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";

/**
 * Comments and watch live on collections, which come with workspaces:
 * they show only when the `comments` flag and workspaces are both on.
 */
export function useCommentsEnabled(): boolean {
	const { comments } = useFeatures();
	const workspaces = useWorkspacesEnabled();
	return comments && workspaces;
}
