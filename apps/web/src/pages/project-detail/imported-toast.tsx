import type { ToastOptions } from "../../components/ui/toast";
import type { ImportPreview } from "../../features/resources/resource-import-api";
import type { Translate } from "../../i18n/translate";
import { toastText } from "./toast-text";

/** Toast after an import: the root resource, its records or related resources. */
export function importedToast(
	result: ImportPreview,
	t: Translate,
): ToastOptions {
	const [main, ...related] = result.resources;
	const name = main?.name ?? "";
	if (related.length > 0) {
		return {
			title: toastText(
				t("projectDetail.toast.importedRelated", {
					name,
					count: related.length,
				}),
			),
		};
	}
	const count = main?.sampleKind === "source" ? main.recordCount : 0;
	if (count > 0) {
		return {
			title: toastText(t("projectDetail.toast.imported", { name, count })),
		};
	}
	return {
		title: toastText(t("projectDetail.toast.importedEmpty", { name })),
		description: t("projectDetail.toast.createdHint"),
	};
}
