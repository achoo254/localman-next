import { useFeatures } from "../../config/features";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";

/** Environments live in workspaces: they need that flag too. */
export function useEnvironmentsEnabled(): boolean {
	const { environments } = useFeatures();
	return useWorkspacesEnabled() && environments;
}
