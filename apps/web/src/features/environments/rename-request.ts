/**
 * "Rename" from a menu outside the environment's page: the page opens (or
 * is shown again) and its header puts the focus in the name box. A request
 * waits for a header that mounts later, and reaches one already open.
 */
import { type RefObject, useEffect } from "react";

const pending = new Set<string>();
const listeners = new Set<(id: string) => void>();

export function requestRename(environmentId: string): void {
	pending.add(environmentId);
	for (const listener of listeners) listener(environmentId);
}

/** Focuses and selects the name box in `scope` when a rename is asked. */
export function useRenameRequest(
	environmentId: string,
	scope: RefObject<HTMLElement | null>,
): void {
	useEffect(() => {
		const answer = (id: string) => {
			if (id !== environmentId || !scope.current) return;
			pending.delete(id);
			// After the tab switch has painted the page.
			window.setTimeout(() => {
				const input = scope.current?.querySelector<HTMLInputElement>(
					'[data-id="environment-header-title"]',
				);
				input?.focus();
				input?.select();
			}, 0);
		};
		listeners.add(answer);
		if (pending.has(environmentId)) answer(environmentId);
		return () => {
			listeners.delete(answer);
		};
	}, [environmentId, scope]);
}
