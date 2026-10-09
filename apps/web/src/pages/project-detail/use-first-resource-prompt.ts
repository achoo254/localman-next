import { useEffect, useRef } from "react";

/** Delay before an empty project offers "Resource mới" (as in the source). */
export const EMPTY_PROMPT_DELAY_MS = 500;

/**
 * An empty project offers its first resource once, shortly after opening,
 * unless the user already opened another dialog (members, mock URL): the
 * form would otherwise stack over it.
 */
export function useFirstResourcePrompt(
	empty: boolean,
	otherDialogOpen: boolean,
	open: () => void,
): void {
	const prompted = useRef(false);
	const openRef = useRef(open);
	openRef.current = open;
	useEffect(() => {
		if (otherDialogOpen) prompted.current = true;
		if (!empty || prompted.current) return;
		const timer = window.setTimeout(() => {
			prompted.current = true;
			openRef.current();
		}, EMPTY_PROMPT_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [empty, otherDialogOpen]);
}
