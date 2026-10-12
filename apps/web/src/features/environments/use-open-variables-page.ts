import { useCallback } from "react";
import { useT } from "../../i18n/i18n-context";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";

/** Tab id of an environment's or a workspace's globals page. */
export const variablesPageId = (
	kind: "environment" | "globals",
	targetId: string,
): string => `${kind}-${targetId}`;

/** Opens (or shows again) an environment or the globals as a tab. */
export function useOpenVariablesPage() {
	const t = useT();
	const { openPage } = useWorkbenchActions();
	const openEnvironment = useCallback(
		(id: string, name: string) =>
			openPage({
				id: variablesPageId("environment", id),
				kind: "environment",
				targetId: id,
				name,
			}),
		[openPage],
	);
	const openGlobals = useCallback(
		(workspaceId: string) =>
			openPage({
				id: variablesPageId("globals", workspaceId),
				kind: "globals",
				targetId: workspaceId,
				name: t("environments.globals.title"),
			}),
		[openPage, t],
	);
	return { openEnvironment, openGlobals };
}
