/**
 * "Import environment" of the import dialog: sends the file's JSON to the
 * current workspace, opens the new environment and says so. The server
 * checks the file (400 INVALID_ENVIRONMENT_FILE names the problem, 403
 * for a Viewer, 409 ENVIRONMENT_LIMIT_REACHED); its message is shown.
 */
import { workspaceRoleAllows } from "@localman/shared/access";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../components/ui/toast";
import { useT } from "../../../i18n/i18n-context";
import { errorMessage } from "../../../lib/api-client";
import { importEnvironment } from "../../environments/environments-api";
import { storeEnvironment } from "../../environments/use-environments";
import { useOpenVariablesPage } from "../../environments/use-open-variables-page";
import { useCurrentWorkspace } from "../../workspaces/current-workspace";
import type { EnvironmentImport } from "./environment-import-note";
import type { ImportedEnvironmentSelection } from "./open-imported";

export interface ImportEnvironmentSelection {
	/** Whether the dialog offers "Import environment", or why not. */
	availability: EnvironmentImport;
	importSelection: (selection: ImportedEnvironmentSelection) => void;
}

/**
 * Unavailable while environments are off or no workspace is current; a
 * Viewer of the current workspace cannot add one.
 */
export function useImportEnvironmentSelection(
	enabled: boolean,
): ImportEnvironmentSelection {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const { current } = useCurrentWorkspace(enabled);
	const { openEnvironment } = useOpenVariablesPage();
	const workspaceId = current?.id ?? null;
	const mutation = useMutation({
		mutationFn: (file: unknown) => importEnvironment(workspaceId ?? "", file),
		onSuccess: (detail) => {
			storeEnvironment(client, detail);
			openEnvironment(detail.id, detail.name);
			toast.show({
				tone: "success",
				title: t("environments.file.imported", { name: detail.name }),
			});
		},
		onError: (error) =>
			toast.show({
				tone: "error",
				title: t("environments.file.importFailed"),
				description: errorMessage(error),
			}),
	});
	let availability: EnvironmentImport = "unavailable";
	if (enabled && current) {
		const allowed = workspaceRoleAllows(current.role, "addElements");
		availability = allowed ? "allowed" : "viewer";
	}
	return {
		availability,
		importSelection: (selection) => {
			if (availability === "allowed") mutation.mutate(selection.file);
		},
	};
}
