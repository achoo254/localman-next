import { waitFor } from "@testing-library/react";

/**
 * The toast whose whole text contains `text`. Toasts format counts and
 * names with <b>, so their text spans several nodes.
 */
export function findToast(text: string): Promise<HTMLElement> {
	return waitFor(() => {
		const toasts = [...document.querySelectorAll<HTMLElement>("li[data-tone]")];
		const hit = toasts.find((toast) =>
			(toast.textContent ?? "").replace(/\s+/g, " ").includes(text),
		);
		if (!hit) throw new Error(`No toast containing "${text}"`);
		return hit;
	});
}
