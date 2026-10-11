import { createContext, useContext, useEffect } from "react";

/** What an open collection, folder or example page hands the workbench. */
export interface PageSaveEntry {
	collectionId: string;
	/** Save now (Ctrl/Cmd+S). */
	flush: () => void;
	/** Drops edits not saved yet; `true` when there were some. */
	discard: () => boolean;
}

export interface PageSaves {
	register: (pageId: string, entry: PageSaveEntry | null) => void;
	/**
	 * Drops what open pages of a collection have not saved yet (after a
	 * restore, which they must not overwrite); how many pages had some.
	 */
	discard: (collectionId: string) => number;
}

export const PageSaveContext = createContext<PageSaves | null>(null);

/** Hands the page's flush and discard to the workbench while it is shown. */
export function useRegisterPageSave(
	pageId: string,
	collectionId: string,
	autosave: Pick<PageSaveEntry, "flush" | "discard">,
): void {
	const saves = useContext(PageSaveContext);
	const { flush, discard } = autosave;
	useEffect(() => {
		if (!saves) return;
		saves.register(pageId, { collectionId, flush, discard });
		return () => saves.register(pageId, null);
	}, [saves, pageId, collectionId, flush, discard]);
}

/** `discard` of the workbench's open pages (a no-op outside it). */
export function useDiscardPageEdits(): (collectionId: string) => number {
	return useContext(PageSaveContext)?.discard ?? (() => 0);
}
