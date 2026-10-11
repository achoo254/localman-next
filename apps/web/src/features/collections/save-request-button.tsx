import { IconDeviceFloppy } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import type { WorkbenchTab } from "../api-client/workbench/workbench-types";
import { useCollection } from "./use-collections";
import type { SaveRequest } from "./use-request-save";

export interface SaveRequestButtonProps {
	tab: WorkbenchTab;
	onSave: SaveRequest;
}

/** "Save" of the request head; hidden for a Viewer of the bound collection. */
export function SaveRequestButton({ tab, onSave }: SaveRequestButtonProps) {
	const t = useT();
	const [saving, setSaving] = useState(false);
	const collection = useCollection(
		tab.source?.collectionId ?? "",
		tab.source !== null,
	);
	if (tab.source && collection.data?.role === "viewer") return null;
	return (
		<Button
			variant="ghost"
			size="sm"
			data-id="request-head-save"
			loading={saving}
			aria-label={t(
				tab.source ? "collections.save.button" : "collections.save.buttonLabel",
			)}
			onClick={async () => {
				setSaving(true);
				try {
					await onSave(tab);
				} finally {
					setSaving(false);
				}
			}}
		>
			<IconDeviceFloppy size={16} aria-hidden="true" />
			<span className="max-sm:sr-only">{t("collections.save.button")}</span>
		</Button>
	);
}
