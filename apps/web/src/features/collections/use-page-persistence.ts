/**
 * Collection, folder and example tabs survive a reload: they are saved in
 * this browser (`page-storage.ts`) and restored once per account. A page
 * whose item is gone shows its "no longer exists" state and can be closed.
 */
import { useEffect, useState } from "react";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../api-client/workbench/workbench-context";
import { useCurrentUser } from "../auth/use-current-user";
import { pagesStorageKey, readPages } from "./page-storage";

export function usePagePersistence(enabled: boolean): void {
	const session = useCurrentUser();
	const sub = session.status === "authenticated" ? session.user.sub : null;
	const { pages, syncStatus } = useWorkbenchState();
	// After the request tabs (drafts API) are back, so a page never takes
	// the place of the tab that was active before the reload.
	const tabsBack = syncStatus.state !== "loading";
	const { restorePages } = useWorkbenchActions();
	// The account whose saved pages are back in the workbench. State, not a
	// ref: writing starts on the render after the restore, never before it.
	const [restored, setRestored] = useState<string | null>(null);

	useEffect(() => {
		if (!enabled || !sub || !tabsBack || restored === sub) return;
		const saved = readPages(sub);
		if (saved.length > 0) restorePages(saved);
		setRestored(sub);
	}, [enabled, sub, tabsBack, restored, restorePages]);

	useEffect(() => {
		if (!enabled || !sub || restored !== sub) return;
		try {
			window.localStorage.setItem(pagesStorageKey(sub), JSON.stringify(pages));
		} catch {
			// Storage unavailable: the pages last for this visit only.
		}
	}, [enabled, sub, restored, pages]);
}
