import { useFeatures } from "../../config/features";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";

/** Forks live on collections and environments: the `forks` flag and workspaces. */
export function useForksEnabled(): boolean {
	const { forks } = useFeatures();
	const workspaces = useWorkspacesEnabled();
	return forks && workspaces;
}
