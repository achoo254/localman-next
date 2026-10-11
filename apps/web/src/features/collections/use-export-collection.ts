/**
 * Export of a stored collection as a Collection v2.1 file, written by the
 * same shared exporter as the API's export: secret variable values are
 * left empty, and the toast says so when the collection has any.
 */
import {
	type CollectionDetail,
	exportCollectionV21,
	nodesToCollectionTree,
} from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { downloadText } from "../../platform/download";
import { fileSlug } from "../api-client/import-export/export-files";
import { collectionErrorMessage } from "./collection-errors";
import { fetchCollection } from "./collections-api";
import { collectionKey } from "./use-collections";

export interface CollectionFile {
	filename: string;
	json: string;
	/** Some variable is secret: its value is blank in the file. */
	secretsBlank: boolean;
}

export function collectionExportFile(detail: CollectionDetail): CollectionFile {
	const document = exportCollectionV21(nodesToCollectionTree(detail));
	return {
		filename: `${fileSlug(detail.name)}.collection.json`,
		json: `${JSON.stringify(document, null, 2)}\n`,
		secretsBlank: detail.variables.some((variable) => variable.secret),
	};
}

/** Downloads the collection (fetched fresh); reports in a toast. */
export function useExportCollection(): (
	collectionId: string,
	name: string,
) => Promise<void> {
	const client = useQueryClient();
	const toast = useToast();
	const t = useT();
	return useCallback(
		async (collectionId: string, name: string) => {
			try {
				const detail = await client.fetchQuery({
					queryKey: collectionKey(collectionId),
					queryFn: () => fetchCollection(collectionId),
				});
				const file = collectionExportFile(detail);
				downloadText(
					file.filename,
					file.json,
					"application/json;charset=utf-8",
				);
				toast.show({
					tone: "success",
					title: t("collections.toast.exported", { file: file.filename }),
					description: file.secretsBlank
						? t("apiClientTools.import.export.secretsBlank")
						: undefined,
				});
			} catch (error) {
				toast.show({
					tone: "error",
					title: t("collections.toast.exportFailed", { name }),
					description: collectionErrorMessage(error, t),
				});
			}
		},
		[client, toast, t],
	);
}
