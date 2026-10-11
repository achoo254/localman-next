import type { ImportedCollection } from "@localman/shared/api-client";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { useT } from "../../../i18n/i18n-context";

/** Open the picked requests as tabs, or store the whole import. */
export type ImportMode = "tabs" | "collection";

/** Where "Save as collection" stores an import (workspaces flag on). */
export interface CollectionSaveTarget {
	workspaceName: string;
	/** Rejects with an error whose message is ready to show. */
	save: (collection: ImportedCollection) => Promise<void>;
}

export interface ImportModeChoiceProps {
	mode: ImportMode;
	onChange: (mode: ImportMode) => void;
	workspaceName: string;
}

/** "Open as tabs" / "Save as collection" switch of the import dialog. */
export function ImportModeChoice({
	mode,
	onChange,
	workspaceName,
}: ImportModeChoiceProps) {
	const t = useT();
	return (
		<div className="grid gap-2">
			<SegmentedControl<ImportMode>
				legend={t("collections.import.modeLegend")}
				data-id="modal-import-mode"
				value={mode}
				onChange={onChange}
				options={[
					{
						value: "tabs",
						label: t("collections.import.tabs"),
						"data-id": "modal-import-mode-tabs",
					},
					{
						value: "collection",
						label: t("collections.import.collection"),
						"data-id": "modal-import-mode-collection",
					},
				]}
			/>
			{mode === "collection" ? (
				<p className="m-0 text-muted text-xs">
					{t("collections.import.collectionHint", { workspace: workspaceName })}
				</p>
			) : null}
		</div>
	);
}
