import { useEffect, useRef } from "react";

/** Delay before an empty project offers "New resource" (as in the source). */
export const EMPTY_PROMPT_DELAY_MS = 500;

/**
 * Projects created in this tab whose page has not offered a first
 * resource yet. Memory only: a reload or a later visit is not "right after
 * creating it", so the page then opens without the prompt.
 */
const justCreated = new Set<string>();

/** The projects page calls this once the API has created the project. */
export function markProjectCreated(projectId: string): void {
	justCreated.add(projectId);
}

/**
 * A project opened right after it was created, still empty, offers its
 * first resource once, shortly after opening, unless the user already
 * opened another dialog (members, mock URL): the form would otherwise
 * stack over it. Either way the offer is used up for that project.
 */
export function useFirstResourcePrompt(
	projectId: string,
	empty: boolean,
	otherDialogOpen: boolean,
	open: () => void,
): void {
	const openRef = useRef(open);
	openRef.current = open;
	useEffect(() => {
		if (otherDialogOpen) justCreated.delete(projectId);
		if (!empty || !justCreated.has(projectId)) return;
		const timer = window.setTimeout(() => {
			justCreated.delete(projectId);
			openRef.current();
		}, EMPTY_PROMPT_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [projectId, empty, otherDialogOpen]);
}
