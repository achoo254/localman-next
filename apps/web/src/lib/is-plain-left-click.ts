import type { MouseEvent } from "react";

/**
 * True for an unmodified primary click. Links that route through a platform
 * helper only intercept these and leave "open in new tab" to the browser.
 */
export function isPlainLeftClick(event: MouseEvent): boolean {
	return (
		event.button === 0 &&
		!event.metaKey &&
		!event.ctrlKey &&
		!event.shiftKey &&
		!event.altKey
	);
}
