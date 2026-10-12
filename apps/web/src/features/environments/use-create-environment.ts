import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { createEnvironment, duplicateEnvironment } from "./environments-api";
import { storeEnvironment, useSetActiveEnvironment } from "./use-environments";
import { useOpenVariablesPage } from "./use-open-variables-page";

/**
 * Creates "New environment" in the workspace and opens it as a tab;
 * `activate` also makes it the caller's active environment (the
 * selector's create, so the next send uses it).
 */
export function useCreateEnvironment(
	workspaceId: string,
	{ activate = false }: { activate?: boolean } = {},
) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const setActive = useSetActiveEnvironment(workspaceId);
	const { openEnvironment } = useOpenVariablesPage();
	return useMutation({
		mutationFn: () =>
			createEnvironment(workspaceId, {
				name: t("environments.sidebar.newName"),
			}),
		onSuccess: (detail) => {
			storeEnvironment(client, detail);
			openEnvironment(detail.id, detail.name);
			if (activate) setActive.mutate(detail.id);
		},
		onError: (error) =>
			toast.show({
				tone: "error",
				title: t("environments.errors.createFailed"),
				description: errorMessage(error),
			}),
	});
}

/** Duplicates an environment and opens the copy as a tab. */
export function useDuplicateEnvironment() {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const { openEnvironment } = useOpenVariablesPage();
	return useMutation({
		mutationFn: duplicateEnvironment,
		onSuccess: (copy) => {
			storeEnvironment(client, copy);
			openEnvironment(copy.id, copy.name);
		},
		onError: (error) =>
			toast.show({
				tone: "error",
				title: t("environments.errors.duplicateFailed"),
				description: errorMessage(error),
			}),
	});
}
