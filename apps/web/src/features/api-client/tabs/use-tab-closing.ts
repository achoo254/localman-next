import { useCallback, useState } from "react";
import { useT } from "../../../i18n/i18n-context";
import { useWorkbenchActions } from "../workbench/workbench-context";
import type { CloseTabPrompt } from "./close-tab-modal";
import { tabLabel } from "./tab-label";

interface PendingClose {
	ids: readonly string[];
	prompt: CloseTabPrompt;
}

/**
 * Closes tabs and pages, asking once when any of them holds unsaved
 * changes: by name for one tab, by count for several.
 */
export function useTabClosing() {
	const t = useT();
	const { closeTabs, currentTabs } = useWorkbenchActions();
	const [pending, setPending] = useState<PendingClose | null>(null);
	const [open, setOpen] = useState(false);

	const requestClose = useCallback(
		(ids: readonly string[]) => {
			if (ids.length === 0) return;
			const closing = new Set(ids);
			const dirty = currentTabs().filter(
				(tab) => tab.dirty && closing.has(tab.id),
			);
			const first = dirty[0];
			if (!first) {
				closeTabs(ids);
				return;
			}
			const prompt: CloseTabPrompt =
				ids.length === 1
					? {
							title: t("apiClient.tabs.unsavedTitle"),
							body: t("apiClient.tabs.unsavedBody", {
								name: tabLabel(first.draft) || t("apiClient.request.untitled"),
							}),
						}
					: {
							title: t("apiClient.tabs.unsavedManyTitle", {
								count: ids.length,
							}),
							body: t("apiClient.tabs.unsavedManyBody", {
								dirty: dirty.length,
							}),
						};
			setPending({ ids, prompt });
			setOpen(true);
		},
		[closeTabs, currentTabs, t],
	);

	const confirm = useCallback(() => {
		if (open && pending) closeTabs(pending.ids);
		setOpen(false);
	}, [closeTabs, open, pending]);

	const cancel = useCallback(() => setOpen(false), []);

	return {
		requestClose,
		open,
		prompt: pending?.prompt ?? null,
		confirm,
		cancel,
	};
}
