import { type KeyboardEvent, type RefObject, useCallback } from "react";

/** Index of the tab a navigation key moves to, or `null` for other keys. */
function targetIndex(key: string, index: number, last: number): number | null {
	switch (key) {
		case "ArrowRight":
			return index === last ? 0 : index + 1;
		case "ArrowLeft":
			return index === 0 ? last : index - 1;
		case "Home":
			return 0;
		case "End":
			return last;
		default:
			return null;
	}
}

/** ←/→, Home/End move between tabs; Delete closes the focused one. */
export function useTabKeys(
	ids: RefObject<readonly string[]>,
	onMove: (tabId: string) => void,
	onDelete: (tabId: string) => void,
) {
	return useCallback(
		(event: KeyboardEvent<HTMLButtonElement>, tabId: string) => {
			const index = ids.current.indexOf(tabId);
			if (index === -1) return;
			const target = targetIndex(event.key, index, ids.current.length - 1);
			if (target !== null) {
				event.preventDefault();
				const next = ids.current[target];
				if (next) onMove(next);
			} else if (event.key === "Delete") {
				event.preventDefault();
				onDelete(tabId);
			}
		},
		[ids, onMove, onDelete],
	);
}
