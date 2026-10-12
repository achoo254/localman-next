/**
 * Name and color of an open environment (autosaved), Duplicate, and
 * whether the caller may duplicate or delete it (Admin or Editor of its
 * workspace, as the API requires).
 */
import type {
	EnvironmentColor,
	EnvironmentDetail,
} from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import { usePageAutosave } from "../collections/use-page-autosave";
import { useWorkspaces } from "../workspaces/current-workspace";
import { duplicateEnvironment, updateEnvironment } from "./environments-api";
import {
	environmentKey,
	environmentListKey,
	storeEnvironment,
} from "./use-environments";
import { useOpenVariablesPage } from "./use-open-variables-page";

type Meta = { name: string; color: EnvironmentColor };

export function useEnvironmentMeta(
	environment: EnvironmentDetail,
	pageId: string,
) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const { renamePage } = useWorkbenchActions();
	const { openEnvironment } = useOpenVariablesPage();
	const { id, workspaceId } = environment;
	// Only name and color: a rename's answer must not bring back older variables.
	const meta = usePageAutosave<Meta>(async (patch) => {
		const saved = await updateEnvironment(id, patch);
		client.setQueryData<EnvironmentDetail>(environmentKey(id), (current) =>
			current
				? {
						...current,
						name: saved.name,
						color: saved.color,
						updatedAt: saved.updatedAt,
					}
				: saved,
		);
		void client.invalidateQueries({
			queryKey: environmentListKey(workspaceId),
		});
		renamePage(pageId, saved.name);
	});
	const workspaceRole = useWorkspaces().data?.find(
		(workspace) => workspace.id === workspaceId,
	)?.role;
	const canManage = workspaceRole === "admin" || workspaceRole === "editor";
	const duplicate = async () => {
		try {
			const copy = await duplicateEnvironment(id);
			storeEnvironment(client, copy);
			openEnvironment(copy.id, copy.name);
		} catch (error) {
			toast.show({
				tone: "error",
				title: t("environments.errors.duplicateFailed"),
				description: errorMessage(error),
			});
		}
	};
	return { meta, canManage, duplicate };
}
