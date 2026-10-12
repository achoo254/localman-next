/**
 * Export and import of environment files. Export downloads what the API
 * writes (shared values only, secrets blank) under the name it suggests.
 * Import reads a picked `.json` file, refuses one that is too large or
 * not JSON before sending, and lets the server check the rest: its
 * INVALID_ENVIRONMENT_FILE message names the problem and is shown as is.
 */
import type { EnvironmentDetail } from "@localman/shared/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { downloadText } from "../../platform/download";
import { readFileBytes } from "../../platform/file-read";
import { exportEnvironment, importEnvironment } from "./environments-api";
import { storeEnvironment } from "./use-environments";
import { useOpenVariablesPage } from "./use-open-variables-page";

/** The API's body limit for an environment import (10 MiB). */
export const ENVIRONMENT_FILE_MAX_MB = 10;
const MAX_BYTES = ENVIRONMENT_FILE_MAX_MB * 1024 * 1024;

/** Why a picked file was refused before it was sent. */
class LocalFileError extends Error {}

/** Downloads an environment's file; reports in a toast. */
export function useExportEnvironment(): (
	id: string,
	name: string,
) => Promise<void> {
	const toast = useToast();
	const t = useT();
	return useCallback(
		async (id: string, name: string) => {
			try {
				const file = await exportEnvironment(id);
				downloadText(
					file.fileName,
					`${JSON.stringify(file.environment, null, 2)}\n`,
					"application/json;charset=utf-8",
				);
				toast.show({
					tone: "success",
					title: t("environments.file.exported", { file: file.fileName }),
					description: t("environments.file.exportedNote"),
				});
			} catch (error) {
				toast.show({
					tone: "error",
					title: t("environments.file.exportFailed", { name }),
					description: errorMessage(error),
				});
			}
		},
		[toast, t],
	);
}

/** Imports a picked file into the workspace and opens the new environment. */
export function useImportEnvironment(workspaceId: string) {
	const client = useQueryClient();
	const toast = useToast();
	const t = useT();
	const { openEnvironment } = useOpenVariablesPage();
	const mutation = useMutation({
		mutationFn: async (file: File): Promise<EnvironmentDetail> => {
			if (file.size > MAX_BYTES) {
				throw new LocalFileError(
					t("environments.file.tooLarge", { max: ENVIRONMENT_FILE_MAX_MB }),
				);
			}
			let text: string;
			try {
				text = new TextDecoder().decode(await readFileBytes(file));
			} catch {
				throw new LocalFileError(t("environments.file.readFailed"));
			}
			let json: unknown;
			try {
				json = JSON.parse(text);
			} catch {
				throw new LocalFileError(t("environments.file.notJson"));
			}
			return importEnvironment(workspaceId, json);
		},
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
				description:
					error instanceof LocalFileError ? error.message : errorMessage(error),
			}),
	});
	return { importFile: mutation.mutate, isPending: mutation.isPending };
}
