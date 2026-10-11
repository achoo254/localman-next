import {
	ImportModal,
	type ImportModalProps,
} from "../api-client/import-export/import-modal";
import { useSaveImportedCollection } from "./use-collection-create";

/**
 * The import dialog with "Save as collection" into the current workspace.
 * Mounted only while the workspaces flag is on, so the plain dialog never
 * loads the workspace list.
 */
export function CollectionsImportModal(
	props: Omit<ImportModalProps, "saveCollection">,
) {
	const saveCollection = useSaveImportedCollection();
	return <ImportModal {...props} saveCollection={saveCollection} />;
}
