/**
 * Restores the server's drafts once, on mount: remembers each as already
 * saved (with its collection binding) and opens them as tabs; tabs opened
 * meanwhile keep their place after these.
 */
import type { ApiRequestDraft } from "@localman/shared/api-client";
import { type Dispatch, type MutableRefObject, useEffect } from "react";
import { activeTranslator } from "../../../i18n/active-translator";
import { errorMessage } from "../../../lib/api-client";
import { listDrafts } from "../api/draft-api";
import type { BindingWrites } from "./use-binding-writes";
import type { WorkbenchAction } from "./workbench-action";
import type { DraftSyncStatus } from "./workbench-tab-types";

export function useDraftRestore(
	dispatch: Dispatch<WorkbenchAction>,
	seen: MutableRefObject<Map<string, ApiRequestDraft>>,
	binding: BindingWrites,
	setStatus: Dispatch<(current: DraftSyncStatus) => DraftSyncStatus>,
): void {
	useEffect(() => {
		let active = true;
		listDrafts()
			.then((items) => {
				if (!active) return;
				for (const item of items) {
					seen.current.set(item.tabId, item.draft);
					binding.restored(item.tabId, item.source ?? null);
				}
				dispatch({
					type: "restore",
					tabs: items.map((item) => ({ ...item, id: item.tabId })),
				});
				setStatus((current) =>
					current.state === "loading" ? { state: "idle" } : current,
				);
			})
			.catch((error: unknown) => {
				if (!active) return;
				const message = activeTranslator().t("apiClient.status.loadError", {
					message: errorMessage(error),
				});
				setStatus(() => ({ state: "error", message }));
			});
		return () => {
			active = false;
		};
	}, [dispatch, seen, binding, setStatus]);
}
